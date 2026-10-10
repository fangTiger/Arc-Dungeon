import assert from "node:assert/strict";
import test from "node:test";
import { createArcWallet } from "../apps/web/src/arc/wallet.js";
import { ARC_TESTNET } from "../apps/web/src/arc/network.js";

import { ACCOUNT, createProvider } from "./provider.js";
const OTHER = `0x${"b".repeat(40)}`;

test("没有钱包时连接返回中文错误", async () => {
  const wallet = createArcWallet({ provider: null });
  await assert.rejects(wallet.connect(), /安装.*钱包/);
});

test("连接测试网账户，并在广播前重新验证", async () => {
  const provider = createProvider();
  const wallet = createArcWallet({ provider });
  await wallet.connect();
  assert.equal(wallet.getState().account, ACCOUNT);
  assert.equal(wallet.getState().onTestnet, true);
  assert.equal(await wallet.requireAccount(ACCOUNT), ACCOUNT);
  provider.accounts = [OTHER];
  await assert.rejects(wallet.requireAccount(ACCOUNT), /账户.*变化/);
});

test("4902 添加网络后再次切换，不将添加网络视为切换成功", async () => {
  const provider = createProvider({ chainId: "0x1" });
  const request = provider.request.bind(provider);
  let switches = 0;
  provider.request = async (args) => {
    if (args.method === "wallet_switchEthereumChain" && switches++ === 0) {
      provider.calls.push(args);
      throw Object.assign(new Error("未知链"), { code: 4902 });
    }
    return request(args);
  };
  const wallet = createArcWallet({ provider });
  await wallet.connect();
  await wallet.switchNetwork();
  assert.equal(switches, 2);
  assert.equal(wallet.getState().onTestnet, true);
  const config = provider.calls.find(({ method }) => method === "wallet_addEthereumChain").params[0];
  assert.equal(config.chainId, ARC_TESTNET.chainId);
  assert.equal(config.nativeCurrency.decimals, 18);
});

test("账户、链和断连事件更新状态，销毁后移除监听", async () => {
  const provider = createProvider();
  const states = [];
  const wallet = createArcWallet({ provider, onChange: (state) => states.push(state) });
  await wallet.connect();
  provider.emit("chainChanged", "0x1");
  assert.equal(wallet.getState().onTestnet, false);
  provider.emit("accountsChanged", [OTHER]);
  assert.equal(wallet.getState().account, OTHER);
  provider.emit("disconnect", {});
  assert.equal(wallet.getState().account, null);
  assert.ok(states.length >= 4);
  wallet.destroy();
  assert.equal(provider.listeners.size, 0);
});

test("错误网络及拒绝连接不允许提交", async () => {
  const wallet = createArcWallet({ provider: createProvider({ chainId: "0x1" }) });
  await wallet.connect();
  await assert.rejects(wallet.requireAccount(), /Arc Testnet/);
  const provider = createProvider();
  provider.request = async () => { throw Object.assign(new Error("拒绝"), { code: 4001 }); };
  const rejected = createArcWallet({ provider });
  await assert.rejects(rejected.connect(), /拒绝/);
  assert.equal(rejected.getState().account, null);
});

test("连接请求期间切换账户时，不用过期响应覆盖新账户事件", async () => {
  const provider = createProvider();
  const request = provider.request.bind(provider);
  provider.request = async (args) => {
    if (args.method === "eth_chainId") provider.emit("accountsChanged", [OTHER]);
    return request(args);
  };
  const wallet = createArcWallet({ provider });
  await assert.rejects(wallet.connect(), /变化/);
  assert.equal(wallet.getState().account, OTHER);
});

test("首次授权正常触发账户事件时，连接可以成功", async () => {
  const provider = createProvider();
  const request = provider.request.bind(provider);
  provider.request = async (args) => {
    if (args.method === "eth_requestAccounts") provider.emit("accountsChanged", [ACCOUNT]);
    return request(args);
  };
  const wallet = createArcWallet({ provider });
  await wallet.connect();
  assert.equal(wallet.getState().account, ACCOUNT);
});

test("广播前的过期响应不会覆盖事件更新，且禁止交易", async () => {
  const provider = createProvider();
  const wallet = createArcWallet({ provider });
  await wallet.connect();
  const request = provider.request.bind(provider);
  provider.request = async (args) => {
    if (args.method === "eth_chainId") provider.emit("accountsChanged", [OTHER]);
    return request(args);
  };
  await assert.rejects(wallet.requireAccount(ACCOUNT), /变化/);
  assert.equal(wallet.getState().account, OTHER);
});
