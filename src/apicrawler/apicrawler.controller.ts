import dotenv from "dotenv";
dotenv.config();
import { Logger } from "tslog";
import got from "got";
import { HttpsProxyAgent } from "hpagent";

const log: Logger = new Logger();

const allAssetsURL = "https://www.binance.com/bapi/asset/v2/public/asset/asset/get-all-asset";
const allProductsURL =
    "https://www.binance.com/bapi/asset/v2/public/asset-service/product/get-products?includeEtf=true";
const oldCmsApiURL =
    "https://www.binance.com/gateway-api/v1/public/cms/article/catalog/list/query?catalogId=48&pageNo=1&pageSize=1";
const alternativeNewsURL = "https://www.binance.com/bapi/composite/v3/public/market/notice/get?page=1&rows=1";

const latestNewsURL = "https://www.binance.com/bapi/composite/v1/public/cms/article/latest/query";

export const crawlEndpoints = async (): Promise<void> => {
    const allAssetsPromise = got.get(allAssetsURL, {
        agent: {
            https: new HttpsProxyAgent({
                keepAlive: true,
                keepAliveMsecs: 1000,
                maxSockets: 256,
                maxFreeSockets: 256,
                scheduling: "lifo",
                proxy: "http://sg.proxymesh.com:31280",
            }),
        },
    });

    const allProductsPromise = got.get(allProductsURL, {
        agent: {
            https: new HttpsProxyAgent({
                keepAlive: true,
                keepAliveMsecs: 1000,
                maxSockets: 256,
                maxFreeSockets: 256,
                scheduling: "lifo",
                proxy: "http://sg.proxymesh.com:31280",
            }),
        },
    });

    const oldCmsApiPromise = got.get(oldCmsApiURL, {
        agent: {
            https: new HttpsProxyAgent({
                keepAlive: true,
                keepAliveMsecs: 1000,
                maxSockets: 256,
                maxFreeSockets: 256,
                scheduling: "lifo",
                proxy: "http://sg.proxymesh.com:31280",
            }),
        },
    });

    const alternativeNewsApiPromise = got.get(alternativeNewsURL, {
        agent: {
            https: new HttpsProxyAgent({
                keepAlive: true,
                keepAliveMsecs: 1000,
                maxSockets: 256,
                maxFreeSockets: 256,
                scheduling: "lifo",
                proxy: "http://sg.proxymesh.com:31280",
            }),
        },
    });

    const latestNewsURLApiPromise = got.get(latestNewsURL, {
        agent: {
            https: new HttpsProxyAgent({
                keepAlive: true,
                keepAliveMsecs: 1000,
                maxSockets: 256,
                maxFreeSockets: 256,
                scheduling: "lifo",
                proxy: "http://sg.proxymesh.com:31280",
            }),
        },
    });

    const latestNewsURLApiPromiseData = await latestNewsURLApiPromise;
    if (latestNewsURLApiPromiseData.statusCode !== 200) {
        log.error("Latest news API returned error");
        log.error(latestNewsURLApiPromiseData);
    } else {
        const latestnewsApiData = await latestNewsURLApiPromise.json();
        log.info(new Date().toString() + "Latest news API data");
        log.info(latestnewsApiData);
    }

    const oldCmsApiPromiseData = await oldCmsApiPromise;
    if (oldCmsApiPromiseData.statusCode !== 200) {
        log.error("Old CMS API returned error");
        log.error(oldCmsApiPromiseData);
    } else {
        const cmsApiData = await oldCmsApiPromise.json();
        log.info(new Date().toString() + "Old CMS API data");
        log.info(cmsApiData);
    }

    const allAssetsPromiseData = await allAssetsPromise;
    if (allAssetsPromiseData.statusCode !== 200) {
        log.error("All assets API returned error");
        log.error(allAssetsPromiseData);
    } else {
        const assetsData = await allAssetsPromise.json();
        log.info(new Date().toString() + "All assets data");
        log.info(assetsData);
    }

    const allProductsPromiseData = await allProductsPromise;
    if (allProductsPromiseData.statusCode !== 200) {
        log.error("All Products API returned error");
        log.error(allProductsPromiseData);
    } else {
        const data = await allProductsPromise.json();
        log.info(new Date().toString() + "All products data");
        log.info(data);
    }

    const alternativeNewsPromiseData = await alternativeNewsApiPromise;
    if (alternativeNewsPromiseData.statusCode !== 200) {
        log.error("Alternative news API returned error");
        log.error(alternativeNewsPromiseData);
    } else {
        const data = await alternativeNewsApiPromise.json();
        log.info(new Date().toString() + "Alternative news API data");
        log.info(data);
    }

    return Promise.resolve();
};
