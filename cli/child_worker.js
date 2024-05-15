"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// mineWorker.ts
// import { validateHash, createHash } from './common';
var sha3_1 = require("@noble/hashes/sha3");
function validateHash(hash, difficulty) {
    return hash.slice(0, difficulty).reduce(function (a, b) { return a + b; }, 0) === 0;
}
function int64to8(n) {
    var arr = BigUint64Array.of(n);
    return new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength);
}
function createHash(currentHash, signerAddressBytes, nonce) {
    var dataToHash = new Uint8Array(32 + 32 + 8);
    dataToHash.set(currentHash, 0);
    dataToHash.set(signerAddressBytes, 32);
    dataToHash.set(int64to8(nonce), 64);
    return (0, sha3_1.keccak_256)(dataToHash);
}
var worker_threads_1 = require("worker_threads");
//NOTE: 用来判断当前线程是否是主线程
if (worker_threads_1.isMainThread) {
}
else {
    worker_threads_1.parentPort === null || worker_threads_1.parentPort === void 0 ? void 0 : worker_threads_1.parentPort.on('message', function (event) {
        var startNonce = event.startNonce, currentHash = event.currentHash, signerBytes = event.signerBytes, difficulty = event.difficulty, jobId = event.jobId, nonceRange = event.nonceRange;
        var nonce = BigInt(startNonce);
        var nonceCount = 0; // 全局计数器，用于跟踪处理的nonce数量
        while (nonceCount < nonceRange) {
            nonceCount++;
            var hash = createHash(currentHash, signerBytes, nonce);
            var isValid = validateHash(hash, difficulty);
            if (isValid) {
                console.log('Found valid nonce:', nonce, hash, jobId, difficulty);
                worker_threads_1.parentPort === null || worker_threads_1.parentPort === void 0 ? void 0 : worker_threads_1.parentPort.postMessage({ nonce: nonce, isValid: isValid, jobId: jobId });
                return; // 结束当前worker的工作
            }
            nonce += BigInt(1);
        }
        // 完成当前范围，请求新的nonce起始值
        worker_threads_1.parentPort === null || worker_threads_1.parentPort === void 0 ? void 0 : worker_threads_1.parentPort.postMessage({
            requestNewNonce: true,
            lastNonce: nonce,
            jobId: jobId,
        });
    });
}
