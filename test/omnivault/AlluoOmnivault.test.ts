import { expect } from "chai";
import { ethers, network, upgrades } from "hardhat";
import { BigNumber } from "ethers";

import { AlluoOmnivault, AlluoOmnivault__factory, Exchange, IERC20MetadataUpgradeable } from "../../typechain-types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
function generateRandomNumber(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
describe("Omnivault Tests", function () {
    let omnivault: AlluoOmnivault;
    let signers: SignerWithAddress[];
    let usdc: IERC20MetadataUpgradeable, weth: IERC20MetadataUpgradeable;
    let mooLp1: IERC20MetadataUpgradeable, mooLp2: IERC20MetadataUpgradeable, mooLp3: IERC20MetadataUpgradeable;
    let exchange: Exchange;
    let admin: SignerWithAddress;
    // Existing setup support:
    // https://app.beefy.com/vault/curve-op-f-susd
    // https://app.beefy.com/vault/stargate-op-usdc
    // https://app.beefy.com/vault/hop-op-usdc
    beforeEach(async () => {
        await network.provider.request({
            method: "hardhat_reset",
            params: [{
                forking: {
                    enabled: true,
                    jsonRpcUrl: process.env.OPTIMISM_FORKING_URL as string,
                    //you can fork from last block by commenting next line
                    blockNumber: 87237321,
                },
            },],
        });
        const omniVaultFactory: AlluoOmnivault__factory = await ethers.getContractFactory(
            "AlluoOmnivault"
        );
        signers = await ethers.getSigners();

        usdc = await ethers.getContractAt("IERC20MetadataUpgradeable", "0x7F5c764cBc14f9669B88837ca1490cCa17c31607")
        mooLp1 = await ethers.getContractAt('IERC20MetadataUpgradeable', '0x107Dbf9c9C0EF2Df114159e5C7DC2baf7C444cFF');
        mooLp2 = await ethers.getContractAt("IERC20MetadataUpgradeable", "0xe536F8141D8EB7B1f096934AF3329cB581bFe995");
        mooLp3 = await ethers.getContractAt("IERC20MetadataUpgradeable", "0xE2f035f59De6a952FF699b4EDD0f99c466f25fEc");
        weth = await ethers.getContractAt("IERC20MetadataUpgradeable", "0x4200000000000000000000000000000000000006")
        exchange = await ethers.getContractAt("Exchange", "0x66Ac11c106C3670988DEFDd24BC75dE786b91095")
        admin = signers[19];
        omnivault = (await upgrades.deployProxy(omniVaultFactory, [
            exchange.address,
            usdc.address,
            [mooLp1.address],
            [100],
            admin.address,
            0
        ], {
            initializer: "initialize",
        })) as AlluoOmnivault;

        let usdWhale = await ethers.getImpersonatedSigner("0xebe80f029b1c02862b9e8a70a7e5317c06f62cae")
        // Send 1 eth to the whale
        await signers[0].sendTransaction({ to: usdWhale.address, value: ethers.utils.parseEther("1") })
        for (let i = 0; i < 10; i++) {
            await usdc.connect(usdWhale).transfer(signers[i].address, ethers.utils.parseUnits("100000", 6))
        }
    });
    describe("Core functions of the vaults", function () {
        it("Deposit when there is only 1 moo LP vault. All funds should go to that Moo vault.", async function () {
            await usdc.connect(signers[0]).approve(omnivault.address, ethers.utils.parseUnits("100", 6));
            await omnivault.connect(signers[0]).deposit(usdc.address, ethers.utils.parseUnits("100", 6));
            expect(await mooLp1.balanceOf(omnivault.address)).greaterThan(0);
            expect(await usdc.balanceOf(omnivault.address)).equal(0);
        });
        it("Withdraw when there is only 1 moo LP vault. All funds should go back to the user in USDC.", async function () {
            await usdc.connect(signers[0]).approve(omnivault.address, ethers.utils.parseUnits("100", 6));
            await omnivault.connect(signers[0]).deposit(usdc.address, ethers.utils.parseUnits("100", 6));
            let signerUSDCBalanceBeforeWithdrawal = await usdc.balanceOf(signers[0].address);

            await omnivault.connect(signers[0]).withdraw(usdc.address, 100);
            // Should equal zero because signer is the only depositor
            expect(await mooLp1.balanceOf(omnivault.address)).to.equal(0);
            expect(signerUSDCBalanceBeforeWithdrawal).lessThan(await usdc.balanceOf(signers[0].address));
            expect(await usdc.balanceOf(omnivault.address)).equal(0);

        })
        it("Trying to withdraw more than 100% should revert", async function () {
            await expect(omnivault.connect(signers[0]).withdraw(usdc.address, 101)).to.be.revertedWith("!LTE100")
        })
        it("Trying to withdraw 0% should revert", async function () {
            await expect(omnivault.connect(signers[0]).withdraw(usdc.address, 0)).to.be.revertedWith("!GT0")
        })
        it("Depositing zero amounts should revert", async function () {
            await usdc.connect(signers[0]).approve(omnivault.address, ethers.utils.parseUnits("100", 6));
            await expect(omnivault.connect(signers[0]).deposit(usdc.address, 0)).to.be.revertedWith("!GT0")
        })


        it("Multiple depositors should be able to deposit and then withdraw fully. All funds should go back to the user in USDC.", async function () {
            for (let i = 0; i < 5; i++) {
                await usdc.connect(signers[i]).approve(omnivault.address, ethers.utils.parseUnits("100", 6));
                await omnivault.connect(signers[i]).deposit(usdc.address, ethers.utils.parseUnits("100", 6));
            }
            for (let i = 0; i < 5; i++) {
                await omnivault.connect(signers[i]).withdraw(usdc.address, 100);
            }
            expect(await mooLp1.balanceOf(omnivault.address)).to.equal(0);
            expect(await usdc.balanceOf(omnivault.address)).equal(0);

        })


        // Use mocks separately to test checking the mappings and enumerable sets directly. This comes later.
    })


    describe("Redistribution tests", function () {
        it("Remain in same vault. Should do nothing since this vault isn't boosted (separate tests for boosted rewards", async function () {
            await usdc.connect(signers[0]).approve(omnivault.address, ethers.utils.parseUnits("100", 6));
            await omnivault.connect(signers[0]).deposit(usdc.address, ethers.utils.parseUnits("100", 6));
            let mooLp1TokensBefore = await mooLp1.balanceOf(omnivault.address);
            await omnivault.connect(admin).redistribute([], [], []);
            let mooLp1Tokens = await mooLp1.balanceOf(omnivault.address);
            expect(mooLp1TokensBefore).to.equal(mooLp1Tokens);
        })
        it("Redistribution from mooVault1 --> mooVault2", async function () {
            await usdc.connect(signers[0]).approve(omnivault.address, ethers.utils.parseUnits("100", 6));
            await omnivault.connect(signers[0]).deposit(usdc.address, ethers.utils.parseUnits("100", 6));
            let mooLp2TokensBefore = await mooLp2.balanceOf(omnivault.address);
            await omnivault.connect(admin).redistribute([mooLp2.address], [100], [ethers.constants.AddressZero]);
            let mooLp2Tokens = await mooLp2.balanceOf(omnivault.address);
            expect(mooLp2TokensBefore).to.equal(0);
            expect(Number(mooLp2Tokens)).greaterThan(Number(mooLp2TokensBefore));
            // console.log("number of mooLp2 tokens after redistribution: " + mooLp2Tokens.toString());
            // Just check how much USD comes back from the mooLp2 tokens
            // console.log(await omnivault.connect(signers[0]).callStatic.withdraw(usdc.address, 100));
        })
        it("Redistribution from mooVault1 --> mooVault2 and mooVault3 in even proportion", async function () {
            await usdc.connect(signers[0]).approve(omnivault.address, ethers.utils.parseUnits("100", 6));
            await omnivault.connect(signers[0]).deposit(usdc.address, ethers.utils.parseUnits("100", 6));
            let mooLp2TokensBefore = await mooLp2.balanceOf(omnivault.address);
            let mooLp3TokensBefore = await mooLp3.balanceOf(omnivault.address);
            await omnivault.connect(admin).redistribute([mooLp2.address, mooLp3.address], [50, 50], [ethers.constants.AddressZero, ethers.constants.AddressZero]);
            let mooLp2Tokens = await mooLp2.balanceOf(omnivault.address);
            let mooLp3Tokens = await mooLp3.balanceOf(omnivault.address);
            expect(mooLp2TokensBefore).to.equal(0);
            expect(mooLp3TokensBefore).to.equal(0);
            expect(Number(mooLp2Tokens)).greaterThan(Number(mooLp2TokensBefore));
            expect(Number(mooLp3Tokens)).greaterThan(Number(mooLp3TokensBefore));
            console.log("number of mooLp2 tokens after redistribution: " + mooLp2Tokens.toString());
            console.log("number of mooLp3 tokens after redistribution: " + mooLp3Tokens.toString());
            // Just check how much USD comes back from the mooLp2 tokens
            console.log(await omnivault.connect(signers[0]).callStatic.withdraw(usdc.address, 100));
        })
        it("Redistribution form mooVault1 --> 33% of each mooVault1, mooVault2 and mooVault3", async function () {
            await usdc.connect(signers[0]).approve(omnivault.address, ethers.utils.parseUnits("100", 6));
            await omnivault.connect(signers[0]).deposit(usdc.address, ethers.utils.parseUnits("100", 6));
            let mooLp1TokensBefore = await mooLp1.balanceOf(omnivault.address);
            let mooLp2TokensBefore = await mooLp2.balanceOf(omnivault.address);
            let mooLp3TokensBefore = await mooLp3.balanceOf(omnivault.address);
            await omnivault.connect(admin).redistribute([mooLp1.address, mooLp2.address, mooLp3.address], [33, 33, 33], [ethers.constants.AddressZero, ethers.constants.AddressZero, ethers.constants.AddressZero]);
            let mooLp1Tokens = await mooLp1.balanceOf(omnivault.address);
            let mooLp2Tokens = await mooLp2.balanceOf(omnivault.address);
            let mooLp3Tokens = await mooLp3.balanceOf(omnivault.address);
            //Existing allocation of mooLp1
            expect(Number(mooLp1TokensBefore)).greaterThan(0)
            expect(mooLp2TokensBefore).to.equal(0);
            expect(mooLp3TokensBefore).to.equal(0);

            expect(Number(mooLp1Tokens)).lessThan(Number(mooLp1TokensBefore));
            expect(Number(mooLp2Tokens)).greaterThan(Number(mooLp2TokensBefore));
            expect(Number(mooLp3Tokens)).greaterThan(Number(mooLp3TokensBefore));
            console.log("number of mooLp1 tokens after redistribution: " + mooLp1Tokens.toString());
            console.log("number of mooLp2 tokens after redistribution: " + mooLp2Tokens.toString());
            console.log("number of mooLp3 tokens after redistribution: " + mooLp3Tokens.toString());
            // Just check how much USD comes back from the mooLp2 tokens
            console.log(await omnivault.connect(signers[0]).callStatic.withdraw(usdc.address, 100));
        })
    })
    describe("Integration testing by simulating rising LP value", function () {
        it("Simulate these LPs rising in value", async function () {
            await usdc.connect(signers[0]).approve(omnivault.address, ethers.utils.parseUnits("1000", 6));
            await omnivault.connect(signers[0]).deposit(usdc.address, ethers.utils.parseUnits("1000", 6));
            let totalFunds = await mooLp1.balanceOf(omnivault.address);
            let simulatedWithdrawValueBefore = await omnivault.connect(signers[0]).callStatic.withdraw(usdc.address, 100);
            await simulateIncreasedValueOfLP(mooLp1.address, ethers.utils.parseEther("5"), mooLp1.address);
            // The LPs should be worth more, let's check this.
            let simulatedWithdrawValueAfter = await omnivault.connect(signers[0]).callStatic.withdraw(usdc.address, 100);
            console.log("Before", simulatedWithdrawValueBefore);
            console.log("After", simulatedWithdrawValueAfter);
            let totalFundsAfter = await mooLp1.balanceOf(omnivault.address);
            expect(Number(simulatedWithdrawValueAfter)).greaterThan(Number(simulatedWithdrawValueBefore));
            // These numbers should be equal, to check that the vault is purely only gaining value from the LPs
            expect(totalFundsAfter).to.equal(totalFunds);
        })
        it("Multiple depositors should receive more USDC when the LPs rise enough in value (accounting for slippage, fees)", async function () {
            let amountIn = ethers.utils.parseUnits("1000", 6);
            for (let i = 0; i < 5; i++) {
                await usdc.connect(signers[i]).approve(omnivault.address, amountIn);
                await omnivault.connect(signers[i]).deposit(usdc.address, amountIn);
            }
            await simulateIncreasedValueOfLP(mooLp1.address, ethers.utils.parseEther("5"), mooLp1.address);
            for (let i = 0; i < 5; i++) {
                let balUsdcBefore = await usdc.balanceOf(signers[i].address);
                await omnivault.connect(signers[i]).withdraw(usdc.address, 100);
                let balUsdcAfter = await usdc.balanceOf(signers[i].address);
                let amountOut = balUsdcAfter.sub(balUsdcBefore);
                console.log("Amount out", amountOut);
                expect(Number(amountOut)).greaterThan(Number(amountIn));
            }
        })

        it("We should be able to track the performance of the vault overtime using an account that deposits an initial 1% amount", async function () {
            let amountIn = ethers.utils.parseUnits("1000", 6);
            await usdc.connect(signers[0]).approve(omnivault.address, amountIn);
            await omnivault.connect(signers[0]).deposit(usdc.address, amountIn);
            for (let i = 0; i < 10; i++) {
                let randomReward = generateRandomNumber(1, 10);
                await simulateIncreasedValueOfLP(mooLp1.address, ethers.utils.parseEther(String(randomReward)), mooLp1.address);
                console.log("Value of investment in %", (await omnivault.connect(signers[0]).callStatic.withdraw(usdc.address, 100)).div(amountIn).mul(100).toString());
            }
        })
    })

    describe("Test to check fee collection", function () {

        it("Should result in NO fee collection as fees are set to zero", async function () {

            await usdc.connect(signers[0]).approve(omnivault.address, ethers.utils.parseUnits("1000", 6));
            await omnivault.connect(signers[0]).deposit(usdc.address, ethers.utils.parseUnits("1000", 6));
            await simulateIncreasedValueOfLP(mooLp1.address, ethers.utils.parseEther("10"), mooLp1.address);
            let adminUSDCBalanceBefore = await usdc.balanceOf(admin.address);
            await omnivault.connect(signers[0]).withdraw(usdc.address, 100)
            expect(await usdc.balanceOf(admin.address)).to.be.equal(adminUSDCBalanceBefore);
        })
        it("Should result in fee collection for full withdrawals", async function () {
            await omnivault.connect(signers[19]).setFeeOnYield(1000);

            await usdc.connect(signers[0]).approve(omnivault.address, ethers.utils.parseUnits("1000", 6));
            await omnivault.connect(signers[0]).deposit(usdc.address, ethers.utils.parseUnits("1000", 6));
            await simulateIncreasedValueOfLP(mooLp1.address, ethers.utils.parseEther("10"), mooLp1.address);
            let adminUSDCBalanceBefore = await usdc.balanceOf(admin.address);
            await omnivault.connect(signers[0]).withdraw(usdc.address, 100)
            let delta = Number(await usdc.balanceOf(admin.address)) - Number(adminUSDCBalanceBefore);
            console.log(delta, "Fee collected")
            expect(Number(await usdc.balanceOf(admin.address))).to.be.greaterThan(Number(adminUSDCBalanceBefore));
            expect(await omnivault.totalUserDeposits(signers[0].address)).to.be.equal(0);

        })
        it("Should result in fee collection for partial withdrawals", async function () {
            await omnivault.connect(signers[19]).setFeeOnYield(1000);

            await usdc.connect(signers[0]).approve(omnivault.address, ethers.utils.parseUnits("1000", 6));
            await omnivault.connect(signers[0]).deposit(usdc.address, ethers.utils.parseUnits("1000", 6));
            await simulateIncreasedValueOfLP(mooLp1.address, ethers.utils.parseEther("10"), mooLp1.address);
            let adminUSDCBalanceBefore = await usdc.balanceOf(admin.address);
            await omnivault.connect(signers[0]).withdraw(usdc.address, 50)
            let delta = Number(await usdc.balanceOf(admin.address)) - Number(adminUSDCBalanceBefore);
            console.log(delta, "Fee collected")
            expect(Number(await usdc.balanceOf(admin.address))).to.be.greaterThan(Number(adminUSDCBalanceBefore));
            expect(await omnivault.totalUserDeposits(signers[0].address)).to.be.equal(ethers.utils.parseUnits("500", 6));

            let adminUSDCBalanceBefore2 = await usdc.balanceOf(admin.address);
            await omnivault.connect(signers[0]).withdraw(usdc.address, 100)
            let delta2 = Number(await usdc.balanceOf(admin.address)) - Number(adminUSDCBalanceBefore2);
            console.log(delta2, "Fee collected")
            expect(Number(await usdc.balanceOf(admin.address))).to.be.greaterThan(Number(adminUSDCBalanceBefore2));
            expect(await omnivault.totalUserDeposits(signers[0].address)).to.be.equal(0);
        })

        it("If fee is 100% on yield, the user should only receive back the principal", async function () {
            await omnivault.connect(signers[19]).setFeeOnYield(10000);

            await usdc.connect(signers[0]).approve(omnivault.address, ethers.utils.parseUnits("1000", 6));
            await omnivault.connect(signers[0]).deposit(usdc.address, ethers.utils.parseUnits("1000", 6));
            await simulateIncreasedValueOfLP(mooLp1.address, ethers.utils.parseEther("10"), mooLp1.address);
            let adminUSDCBalanceBefore = await usdc.balanceOf(admin.address);
            let userUSDCBalanceBefore = await usdc.balanceOf(signers[0].address);
            await omnivault.connect(signers[0]).withdraw(usdc.address, 100)
            let userUSDCBalanceAfter = await usdc.balanceOf(signers[0].address);
            let delta = Number(await usdc.balanceOf(admin.address)) - Number(adminUSDCBalanceBefore);
            console.log(delta, "Fee collected")
            expect(Number(await usdc.balanceOf(admin.address))).to.be.greaterThan(Number(adminUSDCBalanceBefore));
            expect(await omnivault.totalUserDeposits(signers[0].address)).to.be.equal(0);
            expect(Number(userUSDCBalanceAfter.sub(userUSDCBalanceBefore))).to.be.equal(ethers.utils.parseUnits("1000", 6));
        })

    })
    describe("Admin functions", function () {
        it("Should update the primary token correctly", async function () {
            // Add test to check if the updatePrimaryToken function works correctly

        });

    })

    async function simulateIncreasedValueOfLP(vault: string, amount: BigNumber, recipient: string) {
        // Unfortunately we have not added all the underlying LPs, therefore we will use this round abotu method to get the underlying LP.
        let beefyVault = await ethers.getContractAt("IBeefyVault", vault);
        await exchange.connect(signers[5]).exchange(ethers.constants.AddressZero, vault, amount, 0, { value: amount });
        await beefyVault.connect(signers[5]).withdrawAll()
        let want = await beefyVault.want();
        let wantToken = await ethers.getContractAt("IERC20", want);
        await wantToken.connect(signers[5]).transfer(recipient, await wantToken.balanceOf(signers[5].address));
    }
})