// mineWorker.ts
// import { validateHash, createHash } from './common';
import { keccak_256 } from '@noble/hashes/sha3';
function validateHash(hash: Uint8Array, difficulty: number) {
    return hash.slice(0, difficulty).reduce((a, b) => a + b, 0) === 0;
}
function int64to8(n: bigint) {
    const arr = BigUint64Array.of(n);
    return new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength);
}
function createHash(
    currentHash: Uint8Array,
    signerAddressBytes: Uint8Array,
    nonce: bigint
): Uint8Array {
    const dataToHash = new Uint8Array(32 + 32 + 8);
    dataToHash.set(currentHash, 0);
    dataToHash.set(signerAddressBytes, 32);
    dataToHash.set(int64to8(nonce), 64);
    return keccak_256(dataToHash);
}

import { isMainThread, parentPort } from 'worker_threads';
//NOTE: 用来判断当前线程是否是主线程
if (isMainThread) {
} else {
    parentPort?.on('message', (event) => {
        const {
            startNonce,
            currentHash,
            signerBytes,
            difficulty,
            jobId,
            nonceRange,
        } = event;
        let nonce = BigInt(startNonce);
        let nonceCount = 0; // 全局计数器，用于跟踪处理的nonce数量
        while (nonceCount < nonceRange) {
            nonceCount++;
            const hash = createHash(currentHash, signerBytes, nonce);
            const isValid = validateHash(hash, difficulty);

            if (isValid) {
                console.log('Found valid nonce:', nonce, hash, jobId, difficulty);
                parentPort?.postMessage({ nonce: nonce, isValid, jobId });
                return; // 结束当前worker的工作
            }
            nonce += BigInt(1);
        }
        // 完成当前范围，请求新的nonce起始值
        parentPort?.postMessage({
            requestNewNonce: true,
            lastNonce: nonce,
            jobId,
        });
    });
}
