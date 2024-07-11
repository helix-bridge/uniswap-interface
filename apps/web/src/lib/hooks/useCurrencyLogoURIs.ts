import { ChainId } from '@uniswap/sdk-core'
import { getChain, isSupportedChainId } from 'constants/chains'
import { isSameAddress } from 'utilities/src/addresses'

import EthereumLogo from '../../assets/images/ethereum-logo.png'
import AvaxLogo from '../../assets/svg/avax_logo.svg'
import BnbLogo from '../../assets/svg/bnb-logo.svg'
import CeloLogo from '../../assets/svg/celo_logo.svg'
import MaticLogo from '../../assets/svg/matic-token-icon.svg'
import BRCLogo from '../../assets/svg/brc.svg'
import BTCLogo from '../../assets/svg/btc.svg'
import WBTCLogo from '../../assets/images/wbtc.png'
import RINGLogo from '../../assets/images/ring.png'
import { PORTAL_ETH_CELO, isBitlayer, isCelo, nativeOnChain } from '../../constants/tokens'
import { BRC_BITLAYER_TESTNET, USDC_BITLAYER, USDC_BITLAYER_TESTNET, USDT_BITLAYER, USDT_BITLAYER_TESTNET, USDT_DARWINIA, WBTC_BITLAYER, WBTC_BITLAYER_TESTNET, WRING_DARWINIA } from '@uniswap/smart-order-router'

export function getNativeLogoURI(chainId: ChainId = ChainId.MAINNET): string {
  switch (chainId) {
    case ChainId.POLYGON:
    case ChainId.POLYGON_MUMBAI:
      return MaticLogo
    case ChainId.BNB:
      return BnbLogo
    case ChainId.CELO:
    case ChainId.CELO_ALFAJORES:
      return CeloLogo
    case ChainId.AVALANCHE:
      return AvaxLogo
    case ChainId.BITLAYER_TESTNET:
    case ChainId.BITLAYER:
      return BTCLogo
    case ChainId.DARWINIA:
      return RINGLogo
    default:
      return EthereumLogo
  }
}

function isKnownedUSDC(address: string, chainId: ChainId) {
  switch (chainId) {
    case ChainId.BITLAYER_TESTNET:
      return isSameAddress(address, USDC_BITLAYER_TESTNET.address)
    case ChainId.BITLAYER:
      return isSameAddress(address, USDC_BITLAYER.address)
    default:
      return false
  }
}

function isKnownedUSDT(address: string, chainId: ChainId) {
  switch (chainId) {
    case ChainId.BITLAYER_TESTNET:
      return isSameAddress(address, USDT_BITLAYER_TESTNET.address)
    case ChainId.BITLAYER:
      return isSameAddress(address, USDT_BITLAYER.address)
    case ChainId.DARWINIA:
      return isSameAddress(address, USDT_DARWINIA.address)
    default:
      return false
  }
}

function isKnownedWBTC(address: string, chainId: ChainId) {
  switch (chainId) {
    case ChainId.BITLAYER_TESTNET:
      return isSameAddress(address, WBTC_BITLAYER_TESTNET.address)
    case ChainId.BITLAYER:
      return isSameAddress(address, WBTC_BITLAYER.address)
    default:
      return false
  }
}

export function getTokenLogoURI(address: string, chainId: ChainId = ChainId.MAINNET): string | void {
  const networkName = isSupportedChainId(chainId) ? getChain({ chainId }).assetRepoNetworkName : undefined

  if (isCelo(chainId) && isSameAddress(address, nativeOnChain(chainId).wrapped.address)) {
    return CeloLogo
  }
  if (isCelo(chainId) && isSameAddress(address, PORTAL_ETH_CELO.address)) {
    return EthereumLogo
  }

  if (isKnownedUSDC(address, chainId)) {
    return 'https://raw.githubusercontent.com/Uniswap/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png'
  }
  if (isKnownedUSDT(address, chainId)) {
    return 'https://raw.githubusercontent.com/Uniswap/assets/master/blockchains/ethereum/assets/0xdAC17F958D2ee523a2206206994597C13D831ec7/logo.png'
  }
  if (isKnownedWBTC(address, chainId)) {
    return WBTCLogo
  }
  if (isBitlayer(chainId) && isSameAddress(address, BRC_BITLAYER_TESTNET.address)) {
    return BRCLogo
  }
  if (chainId === ChainId.DARWINIA && isSameAddress(address, WRING_DARWINIA.address)) {
    return RINGLogo
  }

  if (networkName) {
    return `https://raw.githubusercontent.com/Uniswap/assets/master/blockchains/${networkName}/assets/${address}/logo.png`
  }
}
