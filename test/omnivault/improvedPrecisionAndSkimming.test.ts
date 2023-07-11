import { expect } from "chai";
import { ethers, network, upgrades } from "hardhat";
import { BigNumber } from "ethers";

import { AlluoOmnivault, AlluoOmnivault__factory, Exchange, IERC20MetadataUpgradeable } from "../../typechain-types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
describe("Improve precision and implement optional skimming", function () {
    let omnivaults: AlluoOmnivault[] = [];
    let signers: SignerWithAddress[];
    let usdc: IERC20MetadataUpgradeable, weth: IERC20MetadataUpgradeable, ldo: IERC20MetadataUpgradeable, yvOP
    let mooLp1: IERC20MetadataUpgradeable, yearnLp1: IERC20MetadataUpgradeable, mooLp2: IERC20MetadataUpgradeable;
    let exchange: Exchange;
    let admin: SignerWithAddress;
    async function setNetwork() {
        await network.provider.request({
            method: "hardhat_reset",
            params: [{
                forking: {
                    enabled: true,
                    jsonRpcUrl: process.env.OPTIMISM_URL as string,
                    //you can fork from last block by commenting next line
                    blockNumber: 106729201,
                },
            },],
        });
        signers = await ethers.getSigners();

        usdc = await ethers.getContractAt("IERC20MetadataUpgradeable", "0x7F5c764cBc14f9669B88837ca1490cCa17c31607")
        mooLp1 = await ethers.getContractAt('IERC20MetadataUpgradeable', '0x0892a178c363b4739e5Ac89E9155B9c30214C0c0');
        yearnLp1 = await ethers.getContractAt("IERC20MetadataUpgradeable", "0xad17a225074191d5c8a37b50fda1ae278a2ee6a2");
        mooLp2 = await ethers.getContractAt("IERC20MetadataUpgradeable", "0xE2f035f59De6a952FF699b4EDD0f99c466f25fEc");
        weth = await ethers.getContractAt("IERC20MetadataUpgradeable", "0x4200000000000000000000000000000000000006")
        ldo = await ethers.getContractAt("IERC20MetadataUpgradeable", "0xfdb794692724153d1488ccdbe0c56c252596735f")
        yvOP = await ethers.getContractAt("IERC20MetadataUpgradeable", "0x7D2382b1f8Af621229d33464340541Db362B4907")
        exchange = await ethers.getContractAt("Exchange", "0x66Ac11c106C3670988DEFDd24BC75dE786b91095")
        admin = await ethers.getImpersonatedSigner("0xc7061dd515b602f86733fa0a0dbb6d6e6b34aed4");

        let usdWhale = await ethers.getImpersonatedSigner("0xebe80f029b1c02862b9e8a70a7e5317c06f62cae")
        // Send 1 eth to the whale
        await signers[0].sendTransaction({ to: usdWhale.address, value: ethers.utils.parseEther("1") })

        await signers[0].sendTransaction({ to: admin.address, value: ethers.utils.parseEther("1") })
        for (let i = 0; i < 10; i++) {
            await usdc.connect(usdWhale).transfer(signers[i].address, ethers.utils.parseUnits("100000", 6))
        }

        const omniVaultFactory: AlluoOmnivault__factory = await ethers.getContractFactory(
            "AlluoOmnivault"
        );
        let newProxy = await omniVaultFactory.deploy();
        await newProxy.deployed();

        let omnivaultAddresses = ["0x2EC847395B6247Ab72b7B37432989f4547A0e947", "0xA430432eEf5C062D34e4078540b91C2ec7DBe0c9", "0xAf332f4d7A82854cB4B6345C4c133eC60c4eAd87", "0x75862d2fEdb1c6a9123F3b5d5E36D614570B404d", "0xDd7ebC54b851E629E61bc49DFcAed41C13fc67Da", "0x4eC3177F5c2500AAABE56DDbD8907d41d17Fc2E9", "0x306Df6b5D50abeD3f7bCbe7399C4b8e6BD55cB81", "0x2682c8057426FE5c462237eb3bfcfEDFb9539004"]
        // Change upgrade status and upgrade the existing omnivault

        for (let address of omnivaultAddresses) {
            let omnivault = await ethers.getContractAt("AlluoOmnivault", address);
            await omnivault.connect(admin).changeUpgradeStatus(true);
            await omnivault.connect(admin).grantRole(await omnivault.UPGRADER_ROLE(), admin.address)
            await omnivault.connect(admin).upgradeTo(newProxy.address);
            // Now migrate the vault over
            await omnivault.connect(admin).migrateToHigherPrecision();
            omnivaults.push(omnivault);
        }

    }
    beforeEach(async () => {
        await loadFixture(setNetwork);
    });

    it("Should upgrade the current contract, imrprove precision and try catch functioanlity, and then check that deposits work as usual.", async () => {
        // Deposit and withdraw
        for (let omnivault of omnivaults) {
            console.log(omnivault.address);
            let signer0BalanceBefore = await usdc.balanceOf(signers[0].address);
            await usdc.connect(signers[0]).approve(omnivault.address, ethers.utils.parseUnits("100000", 6));
            await omnivault.connect(signers[0]).deposit(usdc.address, ethers.utils.parseUnits("10000", 6));
            await omnivault.connect(signers[0]).withdraw(usdc.address, 10000);
            let signer0BalanceAfter = await usdc.balanceOf(signers[0].address);
            console.log("Delta", signer0BalanceAfter.sub(signer0BalanceBefore));
            expect(signer0BalanceAfter.sub(signer0BalanceBefore)).closeTo(0, ethers.utils.parseUnits("100", 6));
        }
        // -67.767546
        // -65.498719

    })
})