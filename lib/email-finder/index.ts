export {
  classifyApiError,
  createEmailFinderPipeline,
  createInMemoryMxCache,
  createPolyfillSignal,
  createPollyfillSignal,
  createRedisMxCache,
  createTimeoutSignal,
  generateEmailCandidates,
  resolveDomainOrFail,
  resolveDomainOrFailWithPolicy,
  verifyMxRecords,
} from './pipeline'

export type {
  ApiErrorClassification,
  EmailCandidate,
  EmailFinderPipeline,
  EmailFinderPipelineOptions,
  MxCacheStore,
  MxVerifyResult,
  ResolvedDomainResult,
} from './pipeline'
