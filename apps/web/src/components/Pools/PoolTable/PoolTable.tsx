import { ApolloError } from '@apollo/client'
import { ColumnDef, createColumnHelper } from '@tanstack/react-table'
import { InterfaceElementName } from '@uniswap/analytics-events'
import { ChainId, CurrencyAmount, Percent, Token as CoreToken, Currency } from '@uniswap/sdk-core'
import { BRC_BITLAYER_TESTNET, USDC_BITLAYER, USDC_BITLAYER_TESTNET, USDT_BITLAYER, USDT_BITLAYER_TESTNET, USDT_DARWINIA, WBTC_BITLAYER, WBTC_BITLAYER_TESTNET, WRING_DARWINIA } from '@uniswap/smart-order-router'
import { FeeAmount, Pool, Position } from '@uniswap/v3-sdk'
import { ButtonEmphasis, ButtonSize, ThemeButton } from 'components/Button'
import { DoubleCurrencyAndChainLogo } from 'components/DoubleLogo'
import Row from 'components/Row'
import { Table } from 'components/Table'
import { Cell } from 'components/Table/Cell'
import { ClickableHeaderRow, HeaderArrow, HeaderSortText } from 'components/Table/styled'
import { NameText } from 'components/Tokens/TokenTable'
import { MAX_WIDTH_MEDIA_BREAKPOINT } from 'components/Tokens/constants'
import { exploreSearchStringAtom } from 'components/Tokens/state'
import { MouseoverTooltip } from 'components/Tooltip'
import { SupportedInterfaceChainId, chainIdToBackendChain, useChainFromUrlParam } from 'constants/chains'
import { BIPS_BASE } from 'constants/misc'
import { useUpdateManualOutage } from 'featureFlags/flags/outageBanner'
import { PoolSortFields, TablePool, useTopPools } from 'graphql/data/pools/useTopPools'
import { OrderDirection, getSupportedGraphQlChain, gqlToCurrency, unwrapToken } from 'graphql/data/util'
import { useFilterPossiblyMaliciousPositions } from 'hooks/useFilterPossiblyMaliciousPositions'
import { usePools } from 'hooks/usePools'
import { useV3Positions } from 'hooks/useV3Positions'
import { Trans } from 'i18n'
import { useAtom } from 'jotai'
import { atomWithReset, useAtomValue, useResetAtom, useUpdateAtom } from 'jotai/utils'
import { ReactElement, ReactNode, useCallback, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import styled from 'styled-components'
import { ThemedText } from 'theme/components'
import { PositionDetails } from 'types/position'
import { ProtocolVersion, Token } from 'uniswap/src/data/graphql/uniswap-data-api/__generated__/types-and-hooks'
import { currencyId } from 'utils/currencyId'
import { NumberType, useFormatter } from 'utils/formatNumbers'
import { unwrappedToken } from 'utils/unwrappedToken'
import { useAccount } from 'wagmi'

const HEADER_DESCRIPTIONS: Record<PoolSortFields, ReactNode | undefined> = {
  [PoolSortFields.TVL]: undefined,
  [PoolSortFields.Volume24h]: undefined,
  [PoolSortFields.VolumeWeek]: undefined,
  [PoolSortFields.TxCount]: undefined,
  [PoolSortFields.OneDayApr]: <Trans i18nKey="pool.apr.feesNotice" />,
}

const TableWrapper = styled.div`
  margin: 0 auto;
  max-width: ${MAX_WIDTH_MEDIA_BREAKPOINT};
`

const Badge = styled(ThemedText.LabelMicro)`
  padding: 2px 6px;
  background: ${({ theme }) => theme.surface2};
  border-radius: 5px;
`

interface PoolTableValues {
  index: number
  poolDescription: ReactElement
  txCount: number
  tvl: number
  volume24h: number
  volumeWeek: number
  oneDayApr: Percent
  link: string
}

export enum PoolTableColumns {
  Index,
  PoolDescription,
  Transactions,
  TVL,
  Volume24h,
  VolumeWeek,
  OneDayApr,
}

function PoolDescription({
  token0,
  token1,
  feeTier,
  chainId,
  protocolVersion = ProtocolVersion.V3,
}: {
  token0: Token
  token1: Token
  feeTier: number
  chainId: ChainId
  protocolVersion: ProtocolVersion
}) {
  const currencies = [gqlToCurrency(token0), gqlToCurrency(token1)]
  return (
    <Row gap="sm">
      <DoubleCurrencyAndChainLogo chainId={chainId} currencies={currencies} size={28} />
      <NameText>
        {token0.symbol}/{token1.symbol}
      </NameText>
      {protocolVersion === ProtocolVersion.V2 && <Badge>{protocolVersion.toLowerCase()}</Badge>}
      <Badge>{feeTier / BIPS_BASE}%</Badge>
    </Row>
  )
}

// Used to keep track of sorting state for Pool Tables
// declared as atomWithReset because sortMethodAtom and sortAscendingAtom are shared across multiple Pool Table instances - want to be able to reset sorting state between instances
export const sortMethodAtom = atomWithReset<PoolSortFields>(PoolSortFields.TVL)
export const sortAscendingAtom = atomWithReset<boolean>(false)

function useSetSortMethod(newSortMethod: PoolSortFields) {
  const [sortMethod, setSortMethod] = useAtom(sortMethodAtom)
  const setSortAscending = useUpdateAtom(sortAscendingAtom)

  return useCallback(() => {
    if (sortMethod === newSortMethod) {
      setSortAscending((sortAscending) => !sortAscending)
    } else {
      setSortMethod(newSortMethod)
      setSortAscending(false)
    }
  }, [sortMethod, setSortMethod, setSortAscending, newSortMethod])
}

const HEADER_TEXT: Record<PoolSortFields, ReactNode> = {
  [PoolSortFields.TVL]: <Trans i18nKey="common.totalValueLocked" />,
  [PoolSortFields.Volume24h]: <Trans i18nKey="stats.volume.1d" />,
  [PoolSortFields.VolumeWeek]: <Trans i18nKey="pool.volume.sevenDay" />,
  [PoolSortFields.OneDayApr]: <Trans i18nKey="pool.apr.oneDay" />,
  [PoolSortFields.TxCount]: <Trans i18nKey="common.transactions" />,
}

function PoolTableHeader({
  category,
  isCurrentSortMethod,
  direction,
}: {
  category: PoolSortFields
  isCurrentSortMethod: boolean
  direction: OrderDirection
}) {
  const handleSortCategory = useSetSortMethod(category)
  return (
    <MouseoverTooltip disabled={!HEADER_DESCRIPTIONS[category]} text={HEADER_DESCRIPTIONS[category]} placement="top">
      <ClickableHeaderRow $justify="flex-end" onClick={handleSortCategory}>
        {isCurrentSortMethod && <HeaderArrow direction={direction} />}
        <HeaderSortText $active={isCurrentSortMethod}>{HEADER_TEXT[category]}</HeaderSortText>
      </ClickableHeaderRow>
    </MouseoverTooltip>
  )
}

export function TopPoolTable() {
  const chain = getSupportedGraphQlChain(useChainFromUrlParam(), { fallbackToEthereum: true })
  const sortMethod = useAtomValue(sortMethodAtom)
  const sortAscending = useAtomValue(sortAscendingAtom)

  const resetSortMethod = useResetAtom(sortMethodAtom)
  const resetSortAscending = useResetAtom(sortAscendingAtom)
  useEffect(() => {
    resetSortMethod()
    resetSortAscending()
  }, [resetSortAscending, resetSortMethod])

  const { topPools, loading, errorV3, errorV2 } = useTopPools(
    { sortBy: sortMethod, sortDirection: sortAscending ? OrderDirection.Asc : OrderDirection.Desc },
    chain.id
  )
  const combinedError =
    errorV2 && errorV3
      ? new ApolloError({ errorMessage: `Could not retrieve V2 and V3 Top Pools on chain: ${chain.id}` })
      : undefined
  const allDataStillLoading = loading && !topPools.length
  useUpdateManualOutage({ chainId: chain.id, errorV3, errorV2 })

  return (
    <TableWrapper data-testid="top-pools-explore-table">
      <PoolsTable
        pools={topPools}
        loading={allDataStillLoading}
        error={combinedError}
        chainId={chain.id}
        maxWidth={1200}
      />
    </TableWrapper>
  )
}

export function PoolsTable({
  pools,
  loading,
  error,
  loadMore,
  chainId,
  maxWidth,
  maxHeight,
  hiddenColumns,
}: {
  pools?: TablePool[]
  loading: boolean
  error?: ApolloError
  loadMore?: ({ onComplete }: { onComplete?: () => void }) => void
  chainId: SupportedInterfaceChainId
  maxWidth?: number
  maxHeight?: number
  hiddenColumns?: PoolTableColumns[]
}) {
  const { formatNumber, formatPercent } = useFormatter()
  const sortAscending = useAtomValue(sortAscendingAtom)
  const orderDirection = sortAscending ? OrderDirection.Asc : OrderDirection.Desc
  const sortMethod = useAtomValue(sortMethodAtom)
  const filterString = useAtomValue(exploreSearchStringAtom)

  const poolTableValues: PoolTableValues[] | undefined = useMemo(
    () =>
      pools?.map((pool, index) => {
        const poolSortRank = index + 1

        return {
          index: poolSortRank,
          poolDescription: (
            <PoolDescription
              token0={unwrapToken(chainId, pool.token0)}
              token1={unwrapToken(chainId, pool.token1)}
              feeTier={pool.feeTier}
              chainId={chainId}
              protocolVersion={pool.protocolVersion}
            />
          ),
          txCount: pool.txCount,
          tvl: pool.tvl,
          volume24h: pool.volume24h,
          volumeWeek: pool.volumeWeek,
          oneDayApr: pool.oneDayApr,
          link: `/explore/pools/${chainIdToBackendChain({ chainId, withFallback: true }).toLowerCase()}/${pool.hash}`,
          analytics: {
            elementName: InterfaceElementName.POOLS_TABLE_ROW,
            properties: {
              chain_id: chainId,
              pool_address: pool.hash,
              token0_address: pool.token0.address,
              token0_symbol: pool.token0.symbol,
              token1_address: pool.token1.address,
              token1_symbol: pool.token1.symbol,
              pool_list_index: index,
              pool_list_rank: poolSortRank,
              pool_list_length: pools.length,
              search_pool_input: filterString,
            },
          },
        }
      }) ?? [],
    [chainId, filterString, pools]
  )

  const showLoadingSkeleton = loading || !!error
  const columns = useMemo(() => {
    const columnHelper = createColumnHelper<PoolTableValues>()
    return [
      !hiddenColumns?.includes(PoolTableColumns.Index)
        ? columnHelper.accessor((row) => row.index, {
            id: 'index',
            header: () => (
              <Cell justifyContent="center" minWidth={44}>
                <ThemedText.BodySecondary>#</ThemedText.BodySecondary>
              </Cell>
            ),
            cell: (index) => (
              <Cell justifyContent="center" loading={showLoadingSkeleton} minWidth={44}>
                <ThemedText.BodySecondary>{index.getValue?.()}</ThemedText.BodySecondary>
              </Cell>
            ),
          })
        : null,
      !hiddenColumns?.includes(PoolTableColumns.PoolDescription)
        ? columnHelper.accessor((row) => row.poolDescription, {
            id: 'poolDescription',
            header: () => (
              <Cell justifyContent="flex-start" width={240} grow>
                <ThemedText.BodySecondary>
                  <Trans i18nKey="common.pool" />
                </ThemedText.BodySecondary>
              </Cell>
            ),
            cell: (poolDescription) => (
              <Cell justifyContent="flex-start" loading={showLoadingSkeleton} width={240} grow>
                {poolDescription.getValue?.()}
              </Cell>
            ),
          })
        : null,
      !hiddenColumns?.includes(PoolTableColumns.Transactions)
        ? columnHelper.accessor((row) => row.txCount, {
            id: 'transactions',
            header: () => (
              <Cell justifyContent="flex-end" minWidth={120} grow>
                <PoolTableHeader
                  category={PoolSortFields.TxCount}
                  isCurrentSortMethod={sortMethod === PoolSortFields.TxCount}
                  direction={orderDirection}
                />
              </Cell>
            ),
            cell: (txCount) => (
              <Cell justifyContent="flex-end" loading={showLoadingSkeleton} minWidth={120} grow>
                <ThemedText.BodyPrimary>
                  {formatNumber({ input: txCount.getValue?.(), type: NumberType.NFTCollectionStats })}
                </ThemedText.BodyPrimary>
              </Cell>
            ),
          })
        : null,
      !hiddenColumns?.includes(PoolTableColumns.TVL)
        ? columnHelper.accessor((row) => row.tvl, {
            id: 'tvl',
            header: () => (
              <Cell minWidth={120} grow>
                <PoolTableHeader
                  category={PoolSortFields.TVL}
                  isCurrentSortMethod={sortMethod === PoolSortFields.TVL}
                  direction={orderDirection}
                />
              </Cell>
            ),
            cell: (tvl) => (
              <Cell loading={showLoadingSkeleton} minWidth={120} grow>
                <ThemedText.BodyPrimary>
                  {formatNumber({ input: tvl.getValue?.(), type: NumberType.FiatTokenStats })}
                </ThemedText.BodyPrimary>
              </Cell>
            ),
          })
        : null,
      !hiddenColumns?.includes(PoolTableColumns.Volume24h)
        ? columnHelper.accessor((row) => row.volume24h, {
            id: 'volume24h',
            header: () => (
              <Cell minWidth={120} grow>
                <PoolTableHeader
                  category={PoolSortFields.Volume24h}
                  isCurrentSortMethod={sortMethod === PoolSortFields.Volume24h}
                  direction={orderDirection}
                />
              </Cell>
            ),
            cell: (volume24h) => (
              <Cell minWidth={120} loading={showLoadingSkeleton} grow>
                <ThemedText.BodyPrimary>
                  {formatNumber({ input: volume24h.getValue?.(), type: NumberType.FiatTokenStats })}
                </ThemedText.BodyPrimary>
              </Cell>
            ),
          })
        : null,
      !hiddenColumns?.includes(PoolTableColumns.VolumeWeek)
        ? columnHelper.accessor((row) => row.volumeWeek, {
            id: 'volumeWeek',
            header: () => (
              <Cell minWidth={120} grow>
                <PoolTableHeader
                  category={PoolSortFields.VolumeWeek}
                  isCurrentSortMethod={sortMethod === PoolSortFields.VolumeWeek}
                  direction={orderDirection}
                />
              </Cell>
            ),
            cell: (volumeWeek) => (
              <Cell minWidth={120} loading={showLoadingSkeleton} grow>
                <ThemedText.BodyPrimary>
                  {formatNumber({ input: volumeWeek.getValue?.(), type: NumberType.FiatTokenStats })}
                </ThemedText.BodyPrimary>
              </Cell>
            ),
          })
        : null,
      !hiddenColumns?.includes(PoolTableColumns.OneDayApr)
        ? columnHelper.accessor((row) => row.oneDayApr, {
            id: 'oneDayApr',
            header: () => (
              <Cell minWidth={100} grow>
                <PoolTableHeader
                  category={PoolSortFields.OneDayApr}
                  isCurrentSortMethod={sortMethod === PoolSortFields.OneDayApr}
                  direction={orderDirection}
                />
              </Cell>
            ),
            cell: (oneDayApr) => (
              <Cell minWidth={100} loading={showLoadingSkeleton} grow>
                <ThemedText.BodyPrimary>{formatPercent(oneDayApr.getValue?.())}</ThemedText.BodyPrimary>
              </Cell>
            ),
          })
        : null,
      // Filter out null values
    ].filter(Boolean) as ColumnDef<PoolTableValues, any>[]
  }, [formatNumber, formatPercent, hiddenColumns, orderDirection, showLoadingSkeleton, sortMethod])

  return (
    <Table
      columns={columns}
      data={poolTableValues}
      loading={loading}
      error={error}
      loadMore={loadMore}
      maxWidth={maxWidth}
      maxHeight={maxHeight}
    />
  )
}

function getPoolKeys(chainId: ChainId | undefined): [Currency, Currency, FeeAmount][] {
  switch (chainId) {
    case ChainId.BITLAYER_TESTNET:
      return [
        [
          unwrappedToken(USDC_BITLAYER_TESTNET),
          unwrappedToken(USDT_BITLAYER_TESTNET),
          FeeAmount.LOW,
        ],
        [
          unwrappedToken(USDC_BITLAYER_TESTNET),
          unwrappedToken(WBTC_BITLAYER_TESTNET),
          FeeAmount.LOW,
        ],
        [
          unwrappedToken(USDC_BITLAYER_TESTNET),
          unwrappedToken(BRC_BITLAYER_TESTNET),
          FeeAmount.LOW,
        ],
        [
          unwrappedToken(USDT_BITLAYER_TESTNET),
          unwrappedToken(WBTC_BITLAYER_TESTNET),
          FeeAmount.LOW,
        ],
      ]
    case ChainId.BITLAYER:
      return [
        [
          unwrappedToken(USDC_BITLAYER),
          unwrappedToken(WBTC_BITLAYER),
          FeeAmount.LOW,
        ],
        [
          unwrappedToken(USDT_BITLAYER),
          unwrappedToken(WBTC_BITLAYER),
          FeeAmount.LOW,
        ],
      ]
    case ChainId.DARWINIA:
      return [
        [
          unwrappedToken(USDT_DARWINIA),
          unwrappedToken(WRING_DARWINIA),
          FeeAmount.LOW,
        ],
      ]
    default:
      return []
  }
}

export function ChainAllPoolsTable() {
  const account = useAccount();
  const chain = useChainFromUrlParam()

  const pools = usePools(getPoolKeys(chain?.id ?? account.chainId))
  const { positions: userPositions, loading: userPositionsLoading } =
    useV3Positions(account?.address);
  const filteredUserPositions = useFilterPossiblyMaliciousPositions(
    userPositions ?? []
  );

  return (
    <AllPoolsTable
      loading={userPositionsLoading}
      pools={useMemo(
        () => pools.filter((p) => p.at(1)).map((p) => p[1]) as Pool[],
        [pools]
      )}
      positions={filteredUserPositions}
    />
  );
}

interface AllPoolsTableValues {
  index?: number;
  pool?: Pool;
  positions?: PositionDetails[];
}

function AllPoolsTable({
  loading,
  pools,
  positions,
}: {
  loading: boolean;
  pools: Pool[];
  positions: PositionDetails[];
}) {
  const data = useMemo(
    () => pools.map((pool, index) => ({ index: index + 1, pool, positions })),
    [pools, positions]
  );
  const { formatCurrencyAmount } = useFormatter();
  const navigate = useNavigate();

  const columns = useMemo(() => {
    const columnHelper = createColumnHelper<AllPoolsTableValues>();
    return [
      columnHelper.accessor((row) => row.index, {
        id: "index",
        header: () => (
          <Cell justifyContent="center" minWidth={44}>
            <ThemedText.BodySecondary>#</ThemedText.BodySecondary>
          </Cell>
        ),
        cell: (index) => (
          <Cell justifyContent="center" minWidth={44}>
            <ThemedText.BodySecondary>
              {index.getValue?.()}
            </ThemedText.BodySecondary>
          </Cell>
        ),
      }),
      columnHelper.accessor((row) => row.pool, {
        id: "pool",
        header: () => (
          <Cell justifyContent="flex-start" width={180} grow>
            <ThemedText.BodySecondary>{`Pool`}</ThemedText.BodySecondary>
          </Cell>
        ),
        cell: (pool) => {
          const poolValue = pool?.getValue?.();
          return (
            <Cell
              justifyContent="flex-start"
              width={180}
              grow
            >
              {poolValue ? (
                <Row gap="sm">
                  <DoubleCurrencyAndChainLogo
                    chainId={poolValue.chainId}
                    currencies={[
                      unwrappedToken(poolValue.token0),
                      unwrappedToken(poolValue.token1),
                    ]}
                    size={28}
                  />
                  <NameText>
                    {poolValue.token0.symbol}/{poolValue.token1.symbol}
                  </NameText>
                  <Badge>{poolValue.fee / BIPS_BASE}%</Badge>
                </Row>
              ) : null}
            </Cell>
          );
        },
      }),
      // columnHelper.accessor((row) => row.pool, {
      //   id: "balance",
      //   header: () => (
      //     <Cell justifyContent="flex-end" width={120} grow>
      //       <ThemedText.BodySecondary>{`Balance`}</ThemedText.BodySecondary>
      //     </Cell>
      //   ),
      //   cell: (pool) => (
      //     <Cell justifyContent="flex-end" loading={loading} width={120} grow>
      //       {pool?.getValue?.()?.token0Price.toSignificant()}
      //     </Cell>
      //   ),
      // }),
      columnHelper.accessor((row) => row, {
        id: "my-position",
        header: () => (
          <Cell justifyContent="flex-end" minWidth={120} grow>
            <ThemedText.BodySecondary>{`My position`}</ThemedText.BodySecondary>
          </Cell>
        ),
        cell: (row) => {
          const { pool = null, positions = [] } = row.getValue?.() ?? { pool: null, positions: [] };
          const positionsInPool = pool ? positions.filter(
            (p) =>
              p.liquidity.gt(0) &&
              p.fee === pool.fee &&
              p.token0.toLowerCase() === pool.token0.address.toLowerCase() &&
              p.token1.toLowerCase() === pool.token1.address.toLowerCase()
          ).map((p) => (new Position({ pool, liquidity: p.liquidity.toString(), tickLower: p.tickLower, tickUpper: p.tickUpper }))) : [];

          return (
            <Cell
              justifyContent="flex-end"
              loading={loading}
              minWidth={120}
              grow
            >
              <ThemedText.BodyPrimary>
                {positionsInPool.length
                  ? `${formatCurrencyAmount({
                      amount: positionsInPool.reduce(
                        (acc, cur) =>
                          acc ? acc.add(cur.amount0) : cur.amount0,
                        null as null | CurrencyAmount<CoreToken>
                      ),
                    })} / ${formatCurrencyAmount({
                      amount: positionsInPool.reduce(
                        (acc, cur) =>
                          acc ? acc.add(cur.amount1) : cur.amount1,
                        null as null | CurrencyAmount<CoreToken>
                      ),
                    })}`
                  : undefined}
              </ThemedText.BodyPrimary>
            </Cell>
          );
        },
      }),
      columnHelper.accessor((row) => row, {
        id: "deposit",
        header: () => <Cell minWidth={120} grow />,
        cell: (row) => {
          const { pool = null, positions = [] } = row.getValue?.() ?? {
            pool: null,
            positions: [],
          };
          const positionsInPool = pool ? positions.filter(
            (p) =>
              p.liquidity.gt(0) &&
              p.fee === pool.fee &&
              p.token0.toLowerCase() === pool.token0.address.toLowerCase() &&
              p.token1.toLowerCase() === pool.token1.address.toLowerCase()
          ) : [];
          return (
            <Cell minWidth={120} loading={loading} grow>
              <ThemeButton
                size={ButtonSize.medium}
                emphasis={ButtonEmphasis.highSoft}
                disabled={!positionsInPool.length}
                onClick={() => {
                  positionsInPool.length &&
                    pool &&
                    navigate(
                      `/add/${currencyId(
                        unwrappedToken(pool.token0)
                      )}/${currencyId(unwrappedToken(pool.token1))}/${
                        pool.fee
                      }/${positionsInPool[0].tokenId}`
                    );
                }}
              >
                Deposit
              </ThemeButton>
            </Cell>
          );
        },
      }),
      columnHelper.accessor((row) => row, {
        id: "withdraw",
        header: () => <Cell minWidth={120} grow />,
        cell: (row) => {
          const { pool = null, positions = [] } = row.getValue?.() ?? {
            pool: null,
            positions: [],
          };
          const positionsInPool = pool ? positions.filter(
            (p) =>
              p.liquidity.gt(0) &&
              p.fee === pool.fee &&
              p.token0.toLowerCase() === pool.token0.address.toLowerCase() &&
              p.token1.toLowerCase() === pool.token1.address.toLowerCase()
          ) : [];
          return (
            <Cell minWidth={120} loading={loading} grow>
              <ThemeButton
                size={ButtonSize.medium}
                emphasis={ButtonEmphasis.highSoft}
                disabled={!positionsInPool.length}
                onClick={() => {
                  positionsInPool.length &&
                    navigate(`/remove/${positionsInPool[0].tokenId}`);
                }}
              >
                Withdraw
              </ThemeButton>
            </Cell>
          );
        },
      }),
    ];
  }, [loading]);

  return <Table columns={columns} data={data} />;
}
