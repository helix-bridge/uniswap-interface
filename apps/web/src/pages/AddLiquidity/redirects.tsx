import { useAccount } from 'hooks/useAccount'
import { Navigate, useParams } from 'react-router-dom'

import { WRAPPED_NATIVE_CURRENCY } from '../../constants/tokens'
import AddLiquidity from './index'

export default function AddLiquidityWithTokenRedirects() {
  const { currencyIdA, currencyIdB } = useParams<{ currencyIdA: string; currencyIdB: string; feeAmount?: string }>()

  const { chainId } = useAccount()

  // prevent weth + eth
  const isETHOrWETHA =
    currencyIdA === "ETH" ||
    currencyIdA === "BTC" ||
    currencyIdA === "RING" ||
    (chainId !== undefined &&
      currencyIdA === WRAPPED_NATIVE_CURRENCY[chainId]?.address);
  const isETHOrWETHB =
    currencyIdB === "ETH" ||
    currencyIdB === "BTC" ||
    currencyIdB === "RING" ||
    (chainId !== undefined &&
      currencyIdB === WRAPPED_NATIVE_CURRENCY[chainId]?.address);

  if (
    currencyIdA &&
    currencyIdB &&
    (currencyIdA.toLowerCase() === currencyIdB.toLowerCase() || (isETHOrWETHA && isETHOrWETHB))
  ) {
    return <Navigate to={`/add/${currencyIdA}`} replace />
  }
  return <AddLiquidity />
}
