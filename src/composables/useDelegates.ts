import { DelegateWithPercent } from '@/helpers/interfaces';
import { createStandardConfig } from '@/helpers/delegation/index';
import { getInstance } from '@snapshot-labs/lock/plugins/vue3';
import { DELEGATE_VOTES_AND_PROPOSALS } from '@/helpers/queries';
import {
  subgraphRequest,
  sendTransaction
} from '@snapshot-labs/snapshot.js/src/utils';

type DelegatesConfig = {
  delegationType: string;
  delegationContract: string;
  delegationApi: string;
};

type Vote = { created: number; voter: string; choice: any; vp: number };
type Proposal = { created: number; author: string; title: string };
type DelegatesStats = Record<string, { votes: Vote[]; proposals: Proposal[] }>;

const DELEGATES_LIMIT = 18;

function adjustUrl(apiUrl: string) {
  const hostedPattern =
    /https:\/\/thegraph\.com\/hosted-service\/subgraph\/([\w-]+)\/([\w-]+)/;
  const hostedMatch = apiUrl.match(hostedPattern);

  return hostedMatch
    ? `https://api.thegraph.com/subgraphs/name/${hostedMatch[1]}/${hostedMatch[2]}`
    : apiUrl;
}

export function useDelegates(delegatesConfig: DelegatesConfig) {
  const { resolveName } = useResolveName();
  const { apolloQuery } = useApolloQuery();
  const auth = getInstance();

  const standardConfig = createStandardConfig(delegatesConfig.delegationType);

  const delegates = ref<DelegateWithPercent[]>([]);
  const delegate = ref<DelegateWithPercent | null>(null);
  const isLoadingDelegate = ref(false);
  const isLoadingDelegates = ref(false);
  const isLoadingMoreDelegates = ref(false);
  const hasDelegatesLoadFailed = ref(false);
  const hasMoreDelegates = ref(false);
  const resolvedAddress = ref<string | null>(null);
  const delegatesStats = ref<DelegatesStats>({});

  async function _fetchDelegates(orderBy: string, skip = 0) {
    const query: any = standardConfig.getDelegatesQuery({
      skip,
      first: DELEGATES_LIMIT,
      orderBy
    });

    const response = await subgraphRequest(
      adjustUrl(delegatesConfig.delegationApi),
      query
    );

    return standardConfig.formatDelegatesResponse(response);
  }

  async function fetchDelegates(orderBy: string) {
    if (isLoadingDelegates.value) return;
    isLoadingDelegates.value = true;

    try {
      const response = await _fetchDelegates(orderBy);

      delegates.value = response;

      hasMoreDelegates.value = response.length === DELEGATES_LIMIT;
    } catch (err) {
      console.error(err);
      hasDelegatesLoadFailed.value = true;
    } finally {
      isLoadingDelegates.value = false;
    }
  }

  async function fetchMoreDelegates(orderBy: string) {
    if (!delegates.value.length || isLoadingMoreDelegates.value) return;
    isLoadingMoreDelegates.value = true;

    try {
      const response = await _fetchDelegates(orderBy, delegates.value.length);

      delegates.value = [...delegates.value, ...response];

      hasMoreDelegates.value = response.length === DELEGATES_LIMIT;
    } catch (err) {
      console.error(err);
      hasDelegatesLoadFailed.value = true;
    } finally {
      isLoadingMoreDelegates.value = false;
    }
  }

  async function fetchDelegate(id: string) {
    if (isLoadingDelegate.value) return;
    delegate.value = null;
    isLoadingDelegate.value = true;
    try {
      resolvedAddress.value = await resolveName(id);

      if (!resolvedAddress.value) return;
      const query: any = standardConfig.getDelegateQuery(resolvedAddress.value);

      const response = await subgraphRequest(
        adjustUrl(delegatesConfig.delegationApi),
        query
      );

      if (resolvedAddress.value && !response.delegate)
        response.delegate = standardConfig.initEmptyDelegate(
          resolvedAddress.value
        );

      if (response.delegate)
        delegate.value = standardConfig.formatDelegateResponse(response);
    } catch (err) {
      console.error(err);
    } finally {
      isLoadingDelegate.value = false;
    }
  }

  async function fetchDelegateBalance(id: string) {
    const query: any = standardConfig.getBalanceQuery(id.toLowerCase());

    const response = await subgraphRequest(
      adjustUrl(delegatesConfig.delegationApi),
      query
    );

    return standardConfig.formatBalanceResponse(response);
  }

  async function setDelegate(address: string) {
    const contractMethod = standardConfig.getContractDelegateMethod();
    const tx = await sendTransaction(
      auth.web3,
      delegatesConfig.delegationContract,
      contractMethod.abi,
      contractMethod.action,
      [address]
    );
    return tx;
  }

  async function fetchDelegateVotesAndProposals(
    delegates: string[],
    space: string
  ) {
    const response: { votes: Vote[]; proposals: Proposal[] } =
      await apolloQuery({
        query: DELEGATE_VOTES_AND_PROPOSALS,
        variables: {
          delegates,
          space: 'uniswap'
        }
      });

    if (!response) return {};

    const votesAndProposals: DelegatesStats = {};

    delegates.forEach(delegate => {
      votesAndProposals[delegate] = {
        votes: [],
        proposals: []
      };
    });

    response.votes.forEach(vote => {
      const delegate = vote.voter.toLowerCase();
      votesAndProposals[delegate].votes.push(vote);
    });

    response.proposals.forEach(proposal => {
      const delegate = proposal.author.toLowerCase();
      votesAndProposals[delegate].proposals.push(proposal);
    });

    delegatesStats.value = votesAndProposals;
  }

  return {
    isLoadingDelegate,
    isLoadingDelegates,
    isLoadingMoreDelegates,
    hasDelegatesLoadFailed,
    hasMoreDelegates,
    delegate,
    delegates,
    delegatesStats,
    fetchDelegate,
    fetchDelegates,
    fetchMoreDelegates,
    setDelegate,
    fetchDelegateBalance,
    fetchDelegateVotesAndProposals
  };
}
