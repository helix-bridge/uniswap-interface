const fs = require("fs");
const path = require("path");

const packageFilePath = path.join(__dirname, "package.json");
const resPackageFilePath = path.join(__dirname, "package.json.res");

const lockFilePath = path.join(__dirname, "yarn.lock");
const resLockFilePath = path.join(__dirname, "yarn.lock.res");

fs.copyFileSync(resPackageFilePath, packageFilePath);
fs.copyFileSync(resLockFilePath, lockFilePath);
