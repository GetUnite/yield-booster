import { parseEther, parseUnits } from "@ethersproject/units";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers, network, upgrades } from "hardhat";
import { AlluoVaultUpgradeable, Exchange, AlluoVaultPool, IAlluoPool, ICvxBooster, IERC20MetadataUpgradeable, IExchange, IFraxFarmERC20, AlluoLockedVault, AlluoRewardsDistributor } from "../typechain";


async function getImpersonatedSigner(address: string): Promise<SignerWithAddress> {
    await ethers.provider.send(
        'hardhat_impersonateAccount',
        [address]
    );

    return await ethers.getSigner(address);
}

async function skipDays(d: number) {
    ethers.provider.send('evm_increaseTime', [d * 86400]);
    ethers.provider.send('evm_mine', []);
}

describe("Alluo Claim Rewards Tests", function () {
    let signers: SignerWithAddress[];
    let usdc: IERC20MetadataUpgradeable, usdt: IERC20MetadataUpgradeable, frax: IERC20MetadataUpgradeable, crv: IERC20MetadataUpgradeable, cvx: IERC20MetadataUpgradeable, weth: IERC20MetadataUpgradeable;
    let exchange: Exchange;
    let cvxBooster: ICvxBooster;
    const ZERO_ADDR = ethers.constants.AddressZero;
    let AlluoVault1: AlluoVaultUpgradeable;
    let AlluoVault2: AlluoVaultUpgradeable;
    let AlluoVault3: AlluoLockedVault;
    let rewardsDistributor: AlluoRewardsDistributor;
    let fraxUSDC: IERC20MetadataUpgradeable;

    let ethFrxEthLp: IERC20MetadataUpgradeable;
    let rewardToken: IERC20MetadataUpgradeable;
    let cvxEth: IERC20MetadataUpgradeable;
    let alluoPool: IAlluoPool;
    let ethFrxEthPool: IFraxFarmERC20;
    let fxs: IERC20MetadataUpgradeable;


    beforeEach(async () => {
        await network.provider.request({
            method: "hardhat_reset",
            params: [{
                forking: {
                    enabled: true,
                    jsonRpcUrl: process.env.MAINNET_FORKING_URL as string,
                    //you can fork from last block by commenting next line
                    blockNumber: 16620166,
                },
            },],
        });

        signers = await ethers.getSigners();

        usdc = await ethers.getContractAt("IERC20MetadataUpgradeable", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48")
        usdt = await ethers.getContractAt("IERC20MetadataUpgradeable", "0xdAC17F958D2ee523a2206206994597C13D831ec7");
        frax = await ethers.getContractAt('IERC20MetadataUpgradeable', '0x853d955acef822db058eb8505911ed77f175b99e');
        crv = await ethers.getContractAt("IERC20MetadataUpgradeable", "0xD533a949740bb3306d119CC777fa900bA034cd52");
        cvx = await ethers.getContractAt("IERC20MetadataUpgradeable", "0x4e3FBD56CD56c3e72c1403e103b45Db9da5B9D2B");
        weth = await ethers.getContractAt("IERC20MetadataUpgradeable", "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2")
        cvxBooster = await ethers.getContractAt("ICvxBooster", "0xF403C135812408BFbE8713b5A23a04b3D48AAE31");
        exchange = await ethers.getContractAt("Exchange", "0x29c66CF57a03d41Cfe6d9ecB6883aa0E2AbA21Ec")
        cvxEth = await ethers.getContractAt("IERC20MetadataUpgradeable", "0x3A283D9c08E8b55966afb64C515f5143cf907611");
        rewardToken = await ethers.getContractAt("IERC20MetadataUpgradeable", "0x3A283D9c08E8b55966afb64C515f5143cf907611");
        fraxUSDC = await ethers.getContractAt("IERC20MetadataUpgradeable", "0x3175Df0976dFA876431C2E9eE6Bc45b65d3473CC");
        ethFrxEthLp = await ethers.getContractAt("IERC20MetadataUpgradeable", "0xf43211935C781D5ca1a41d2041F397B8A7366C7A");
        ethFrxEthPool = await ethers.getContractAt("IFraxFarmERC20", "0xa537d64881b84faffb9Ae43c951EEbF368b71cdA");
        fxs = await ethers.getContractAt("IERC20MetadataUpgradeable", "0x3432B6A60D23Ca0dFCa7761B7ab56459D9C964D0");

        let value = parseEther("2000.0");

        await exchange.exchange(
            ZERO_ADDR, frax.address, value, 0, { value: value }
        )
        await exchange.exchange(
            ZERO_ADDR, usdt.address, value, 0, { value: value }
        )

        await exchange.exchange(
            ZERO_ADDR, usdc.address, value, 0, { value: value }
        )

        const fraxUSDCPool = await ethers.getContractAt("ICurvePool", "0xDcEF968d416a41Cdac0ED8702fAC8128A64241A2")
        await frax.approve(fraxUSDCPool.address, ethers.constants.MaxUint256)
        await fraxUSDCPool.add_liquidity([parseEther("1000"), 0], 0);

        const cvxEthPool = await ethers.getContractAt("ICurvePool", "0xB576491F1E6e5E62f1d8F26062Ee822B40B0E0d4")
        value = parseEther("100.0");

        await exchange.exchange(
            ZERO_ADDR, cvxEth.address, value, 0, { value: value }
        )
        let gnosis = "0x1F020A4943EB57cd3b2213A66b355CB662Ea43C3";
        let AlluoVaultFactory = await ethers.getContractFactory("AlluoVaultUpgradeable")
        AlluoVault1 = await upgrades.deployProxy(AlluoVaultFactory, [
            "Cvx-Eth Vault",
            "abCvxEth",
            cvxEth.address,
            rewardToken.address,
            rewardToken.address,
            gnosis,
            "0x84a0856b038eaAd1cC7E297cF34A7e72685A8693",
            [crv.address, cvx.address],
            [weth.address, cvx.address],
            64,
            cvxEthPool.address
        ], {
            initializer: 'initialize',
            kind: 'uups'
        }) as AlluoVaultUpgradeable;


        AlluoVault2 = await upgrades.deployProxy(AlluoVaultFactory, [
            "Frax-USDC Vault",
            "abFraxUSDC",
            fraxUSDC.address,
            rewardToken.address,
            rewardToken.address,
            gnosis,
            "0x84a0856b038eaAd1cC7E297cF34A7e72685A8693",
            [crv.address, cvx.address],
            [frax.address, usdc.address],
            100,
            fraxUSDCPool.address
        ], {
            initializer: 'initialize',
            kind: 'uups'
        }) as AlluoVaultUpgradeable;


        let AlluoConvexVault = await ethers.getContractFactory("AlluoLockedVault");

        AlluoVault3 = await upgrades.deployProxy(AlluoConvexVault, [
            "Eth-frxEth Vault",
            "Eth-frxEth",
            ethFrxEthLp.address, // underlying token
            rewardToken.address, // Curve CVX-ETH Convex Deposit (cvxcrvCVX...)
            rewardToken.address, // set pool later
            gnosis,
            "0x84a0856b038eaAd1cC7E297cF34A7e72685A8693", // trusted wallet for meta transactions
            [crv.address, cvx.address, fxs.address], // yield tokens
            ethFrxEthPool.address
        ], {
            initializer: 'initialize',
            kind: 'uups'
        }) as AlluoLockedVault;

        let PoolVaultFactory = await ethers.getContractFactory("AlluoVaultPool");

        alluoPool = await upgrades.deployProxy(PoolVaultFactory, [
            rewardToken.address,
            gnosis,
            [crv.address, cvx.address],
            [AlluoVault1.address, AlluoVault2.address, AlluoVault3.address],
            "0xB576491F1E6e5E62f1d8F26062Ee822B40B0E0d4", // Pool address
            64, //Pool number convex
            cvx.address
        ]) as AlluoVaultPool

        let Rewards = await ethers.getContractFactory("AlluoRewardsDistributor");
        rewardsDistributor = await upgrades.deployProxy(Rewards, [
            rewardToken.address,
            [AlluoVault1.address, AlluoVault2.address, AlluoVault3.address],
            alluoPool.address,
            gnosis
        ]) as AlluoRewardsDistributor;

        await AlluoVault1.setPool(alluoPool.address);
        await AlluoVault2.setPool(alluoPool.address);
        await AlluoVault3.setPool(alluoPool.address);

        await AlluoVault1.grantRole("0x0000000000000000000000000000000000000000000000000000000000000000", alluoPool.address)
        await AlluoVault2.grantRole("0x0000000000000000000000000000000000000000000000000000000000000000", alluoPool.address)
        await AlluoVault3.grantRole("0x0000000000000000000000000000000000000000000000000000000000000000", alluoPool.address)

        await AlluoVault1.grantRole("0x0000000000000000000000000000000000000000000000000000000000000000", alluoPool.address)
        await AlluoVault2.grantRole("0x0000000000000000000000000000000000000000000000000000000000000000", alluoPool.address)
        await AlluoVault3.grantRole("0x0000000000000000000000000000000000000000000000000000000000000000", alluoPool.address)

        await alluoPool.grantRole("0x9905c085208a82a3078cc48cae77ac6481e28f57de8eb7c3f515cba4aa724a26", rewardsDistributor.address);
        await AlluoVault1.grantRole("0x9905c085208a82a3078cc48cae77ac6481e28f57de8eb7c3f515cba4aa724a26", rewardsDistributor.address);
        await AlluoVault2.grantRole("0x9905c085208a82a3078cc48cae77ac6481e28f57de8eb7c3f515cba4aa724a26", rewardsDistributor.address);
        await AlluoVault3.grantRole("0x9905c085208a82a3078cc48cae77ac6481e28f57de8eb7c3f515cba4aa724a26", rewardsDistributor.address);


    });

    it("Claim in other exit token", async () => {

        const lpBalance = await cvxEth.balanceOf(signers[0].address);
        const deposit = lpBalance.div(4)
        await cvxEth.approve(AlluoVault1.address, ethers.constants.MaxUint256);
        await AlluoVault1.deposit(deposit, signers[0].address);
        await AlluoVault1.stakeUnderlying();

        const lpBalance2 = await fraxUSDC.balanceOf(signers[0].address);
        await fraxUSDC.approve(AlluoVault2.address, ethers.constants.MaxUint256);
        await AlluoVault2.deposit(lpBalance2, signers[0].address);
        await AlluoVault2.stakeUnderlying();

        const amount = parseEther("100");
        await AlluoVault3.depositWithoutLP(amount, "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", { value: amount });
        await AlluoVault3.stakeUnderlying();

        await skipDays(0.01);
        await alluoPool.farm();
        await skipDays(7);

        expect(Number(await AlluoVault1.earned(signers[0].address))).greaterThan(0)
        expect(Number(await AlluoVault2.earned(signers[0].address))).greaterThan(0)
        expect(Number(await AlluoVault3.earned(signers[0].address))).greaterThan(0)

        const vaultBalance1 = await alluoPool.balances(AlluoVault1.address);
        const vaultBalance2 = await alluoPool.balances(AlluoVault2.address);
        const vaultBalance3 = await alluoPool.balances(AlluoVault3.address);

        console.log('balance usdc before', await usdc.balanceOf(signers[0].address));
        await rewardsDistributor.claimAll(usdc.address);
        console.log('\nbalance usdc after', await usdc.balanceOf(signers[0].address));

        const vaultBalance1after = await alluoPool.balances(AlluoVault1.address);
        const vaultBalance2after = await alluoPool.balances(AlluoVault2.address);
        const vaultBalance3after = await alluoPool.balances(AlluoVault3.address);

        expect(vaultBalance1after).to.be.lt(vaultBalance1);
        expect(vaultBalance2after).to.be.lt(vaultBalance2);
        expect(vaultBalance3after).to.be.lt(vaultBalance3);

        expect(Number(await AlluoVault1.earned(signers[0].address))).to.be.eq(0)
        expect(Number(await AlluoVault2.earned(signers[0].address))).to.be.eq(0)
        expect(Number(await AlluoVault3.earned(signers[0].address))).to.be.eq(0)

    })

    it("Should return zero", async () => {

        const lpBalance = await cvxEth.balanceOf(signers[0].address);
        const deposit = lpBalance.div(4)
        await cvxEth.approve(AlluoVault1.address, ethers.constants.MaxUint256);
        await AlluoVault1.deposit(deposit, signers[0].address);
        await AlluoVault1.stakeUnderlying();

        const lpBalance2 = await fraxUSDC.balanceOf(signers[0].address);
        await fraxUSDC.approve(AlluoVault2.address, ethers.constants.MaxUint256);
        await AlluoVault2.deposit(lpBalance2, signers[0].address);
        await AlluoVault2.stakeUnderlying();

        const amount = parseEther("100");
        await AlluoVault3.depositWithoutLP(amount, "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", { value: amount });
        await AlluoVault3.stakeUnderlying();

        await skipDays(0.01);

        await alluoPool.farm();

        const tokens = await rewardsDistributor.connect(signers[1]).claimAll(usdc.address);
        const tokens2 = await rewardsDistributor.claimAll(usdc.address);

        // console.log(tokens.value);
        expect(tokens.value).to.be.eq(0);
        expect(tokens2.value).to.be.eq(0);



    });

})

