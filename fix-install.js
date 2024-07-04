const fs = require("fs");
const path = require("path");

const flag = process.argv.at(2);
const filePath = path.join(__dirname, "package.json");
const backFilePath = path.join(__dirname, "package.json.bak");

if (flag === "0") {
  fs.copyFileSync(filePath, backFilePath);

  const data = fs.readFileSync(filePath, "utf-8");
  const packageJson = JSON.parse(data);

  delete packageJson.resolutions["@uniswap/v2-sdk"];
  delete packageJson.resolutions["@uniswap/v3-sdk"];
  delete packageJson.resolutions["@uniswap/router-sdk"];
  delete packageJson.resolutions["@uniswap/uniswapx-sdk"];
  delete packageJson.resolutions["@uniswap/sdk-core"];
  delete packageJson.resolutions["@uniswap/universal-router-sdk"];
  delete packageJson.resolutions["@uniswap/smart-order-router"];

  const updatedPackageJson = JSON.stringify(packageJson, null, 2);
  fs.writeFileSync(filePath, updatedPackageJson, "utf-8");

  // console.info("package.json updated successfully.");
} else if (flag === "1") {
  fs.copyFileSync(backFilePath, filePath);
  fs.unlinkSync(backFilePath);

  // console.info("package.json restored successfully.");
}
