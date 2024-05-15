/* eslint-disable fp/no-loops, fp/no-mutation, fp/no-mutating-methods, fp/no-let, no-constant-condition */

import { program } from 'commander';
import {
    getProof,
    formatBig,
    runner,
    getOrCreateMiner,
    fetchBus,
    CONFIG,
} from '../common';
import { Config, MINE } from '../codegen/mineral/mine/structs';
import { Miner } from '../codegen/mineral/miner/structs';
import { decodeSuiPrivateKey } from '@mysten/sui.js/cryptography';
import { SuiClient, getFullnodeUrl } from '@mysten/sui.js/client';
import { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519';
import { SUI_TYPE_ARG, SUI_DECIMALS } from '@mysten/sui.js/utils';
import chalk from 'chalk';

const { WALLET, RPC } = process.env;

const START_TIME = 1715534935000;
const USAGE_GUIDE =
    'https://github.com/ronanyeah/mineral-app/blob/master/cli/README.md';
const SETUP_PROMPT =
    'Wallet not found. Consult the setup guide: ' + USAGE_GUIDE;

const settings = (() => {
    return {
        wallet: (() => {
            if (!WALLET) {
                return null;
            }
            return Ed25519Keypair.fromSecretKey(
                decodeSuiPrivateKey(WALLET).secretKey
            );
        })(),
        rpc: new SuiClient({
            url: RPC || getFullnodeUrl('mainnet'),
        }),
    };
})();

program
    .name('mineral')
    .description('Mineral CLI Miner\nhttps://mineral.supply/')
    .version('1.0.0');

program
    .command('profile')
    .description('View your mining stats')
    .action((_options) =>
        (async () => {
            if (!settings.wallet) {
                return program.error(SETUP_PROMPT);
            }
            const pub = settings.wallet.toSuiAddress();
            console.log(chalk.green('Wallet:'), pub);
            const minerAcct = await getProof(settings.rpc, pub);
            if (minerAcct) {
                console.log(chalk.green('Miner:'), minerAcct);
            }
            const results = await Promise.all([
                (async () => {
                    const bal = await settings.rpc.getBalance({
                        owner: pub,
                        coinType: SUI_TYPE_ARG,
                    });
                    const val = formatBig(
                        BigInt(bal.totalBalance),
                        SUI_DECIMALS
                    );
                    return [`💧 Sui Balance: ${val} SUI`];
                })(),
                (async () => {
                    const bal = await settings.rpc.getBalance({
                        owner: pub,
                        coinType: MINE.$typeName,
                    });
                    const val = formatBig(
                        BigInt(bal.totalBalance),
                        SUI_DECIMALS
                    );
                    return [`⛏️  Mineral Balance: ${val} $MINE`];
                })(),
                (async () => {
                    const proof = await getProof(settings.rpc, pub);
                    if (!proof) {
                        return [];
                    }
                    const miner = await Miner.fetch(settings.rpc, proof);
                    return [
                        `💰 Lifetime rewards: ${formatBig(
                            miner.totalRewards,
                            9
                        )} $MINE`,
                        `🏭 Lifetime hashes: ${miner.totalHashes}`,
                    ];
                })(),
            ]);
            results.flat().forEach((val) => console.log(val));
        })().catch(console.error)
    );

program
    .command('stats')
    .description('View global Mineral stats')
    .action((_options) =>
        (async () => {
            const config = await Config.fetch(settings.rpc, CONFIG);
            const bus = await fetchBus(settings.rpc);
            console.log(
                'Total distributed rewards:',
                Number(config.totalRewards) / 1_000_000_000,
                '$MINE'
            );
            console.log('Total hashes processed:', Number(config.totalHashes));
            console.log(
                'Current reward rate:',
                Number(bus.rewardRate) / 1_000_000_000,
                '$MINE / hash'
            );
            console.log('Current difficulty:', bus.difficulty);
        })().catch(console.error)
    );
function getFormattedCurrentTime() {
    var now = new Date();

    var year = now.getFullYear();
    var month: any = now.getMonth() + 1; // 注意月份是从0开始的，所以需要加1
    var day: any = now.getDate();
    var hour: any = now.getHours();
    var minute: any = now.getMinutes();
    var second: any = now.getSeconds();

    // 对于个位数的月份、日期、小时、分钟和秒，前面加上0以保持两位数格式
    month = month < 10 ? '0' + month : month;
    day = day < 10 ? '0' + day : day;
    hour = hour < 10 ? '0' + hour : hour;
    minute = minute < 10 ? '0' + minute : minute;
    second = second < 10 ? '0' + second : second;

    var formattedTime =
        year +
        '-' +
        month +
        '-' +
        day +
        ' ' +
        hour +
        ':' +
        minute +
        ':' +
        second;
    return formattedTime;
}

console.log(getFormattedCurrentTime());
program
    .command('create-wallet')
    .description('Create a new Sui wallet')
    .action(async (_options) => {
        const wallet = new Ed25519Keypair();
        console.log(chalk.green('Wallet created:'), wallet.toSuiAddress());
        console.log(chalk.red('Private key:'), wallet.getSecretKey());
        console.log(chalk.blue('Mineral CLI usage guide:'), USAGE_GUIDE);
    });

program
    .command('mine')
    .option('-t, --threads <number>', 'threads', '1')
    .option('-n, --bulk_size <number>', 'task nums of per thread', '100000')
    .option('-k, --key <string>', 'private key', '')
    .description('Start mining ⛏️')
    .action((_options) =>
        (async () => {
            if (_options.key) {
                settings.wallet = Ed25519Keypair.fromSecretKey(
                    decodeSuiPrivateKey(WALLET).secretKey
                );
            }
            if (!settings.wallet) {
                return program.error(SETUP_PROMPT);
            }
            const bal = await settings.rpc.getBalance({
                owner: settings.wallet.toSuiAddress(),
                coinType: SUI_TYPE_ARG,
            });
            if (Number(bal.totalBalance) < 0.1) {
                console.log(
                    chalk.red('Low balance'),
                    'in wallet',
                    settings.wallet.toSuiAddress()
                );
                console.log('Send some SUI to this wallet to enable mining.');
            }

            if (Date.now() < START_TIME) {
                return program.error('⚠️  Mining has not started yet!');
            }

            console.error(
                chalk.green('Mining with wallet:'),
                settings.wallet.toSuiAddress()
            );
            const minerAccount = await getOrCreateMiner(
                settings.wallet,
                settings.rpc
            );
            const bus = await fetchBus(settings.rpc);

            if (!minerAccount) {
                return program.error('Miner account not created!');
            }
            function timeLogger(...args: any[]) {
                console.log(getFormattedCurrentTime(), ':', ...args);
            }
            runner(
                settings.rpc,
                bus.difficulty,
                settings.wallet,
                minerAccount,
                _options.threads,
                _options.bulk_size,
                timeLogger
            );
        })().catch(console.error)
    );

program.parse(process.argv);
