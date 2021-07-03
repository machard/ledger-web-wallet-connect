// @ts-ignore
import coininfo from "coininfo";

const networks = {
  "mainnet": coininfo.bitcoin.main.toBitcoinJS(),
  "praline": coininfo.bitcoin.test.toBitcoinJS()
};

export default networks;
