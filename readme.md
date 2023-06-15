# 📣📣📣 I've launched a new project for all you rekt degens out there: https://jobstash.xyz , a job aggregator for all jobs in crypto.
Check out the launch announcement at https://twitter.com/jobstash_xyz/status/1631319596228567041 and join the telegram at https://telegram.me/jobstash


# Binance Alpha Bot


I built this bot in my spare time between February 2021 and January 2022, and the code was never meant to be shown to anybody. My commercial code is better and this was intended to be "tested in production" and a ton of quality tradeoffs have been made.
Never ever did I plan to release this publicly, lest I "leak my alpha". Now the alpha is public and the edge is gone, so I would like to show off what I've learned in the last year. 

  

## Ser, plz share alpha?

> When a new token is listed in Binance, somewhere between 30-40 MM USD in volume pour in.

> Bots then compete to buy up the token onchain as quickly as possible.

> Also, all sorts of noobs and listing sniping bots get in on the action, compounding profits on Binance when the actual pairs are listed there.

> This bot performs all of that, faster than 99% of others.

  

## But ser, there are open source bots that do the same

> Yes, there indeed are. Mine was first, tho. And I still outperform [https://www.cryptomaton.org/](https://www.cryptomaton.org/). Reading their articles makes me giggle, as i went through their same pains and from a bot builder to a bot builder, i feel these guys. <3

  

## But try harder ser?

> Cobie also documented exactly this strategy in uponly and in his article, so I'm considering the edge gone now. Time to move on.

  

## OK ser, what does this do exactly?

  

- A crawler hits the Binance site and relays its requests through a network of proxies to not get ratelimited by Cloudflare. Cloudflare sets the cache duration to 5 seconds, so we maintain an in-memory list of endpoints that are currently predicted to be cached and only use the ones that are predicted to be uncached.

- Once a new token listing is detected, which doesn't mention stablecoins [*oh boy, the stablecoin listings i've seen on Binance.. wtf guys...*] and which is on the right network, we go and aggressively buy it by using 0x API, using an EIP-1559 TX.

- Send the token to Binance, and sell it there using a limit order at a price that is configured to be a % increase over the initial price pump. If it doesn't fill within a certain amount of time, usually 1.5 seconds, dump at market price before getting rekt.

- Swap back to ETH and send back onchain. $Profit.

  

## But ser, why no flashbots/eden/cowswap/private relay ?

Because the bot must make its purchase in the next available block. Any private relay depends on flashbot mining pools to include a bundle. This gives me a <100% chance of being included in the next block, and that is not a tradeoff I'm willing to take. Same goes for Cowswap, eden, etc. Great to prevent frontrunning, but the sanwiching bots have different profitability algos so all I need to do is price gas higher than their potential profit and I'll be left alone.

  
  

## Wen increase aggressiveness ?

- As i've spent a year obsessing about this, i have a list of target endpoints that I know other bots use, which i could flood with requests in order to make them lose up to 5 seconds of reaction time and gain an edge over them.

  

- Future plans for improvement were actually around observing the mempool for a competing bot TX and outbidding them on gas, essentially starting a frontrunning bot.

  

# Some basic setup info

  

Please go and fill in the .env file with necessary info. Exercise left to the user to figure out what those fields are, you can't have everything served on a silver platter now, can you?

  

## 3rd parties required:

  

-Twilio

  

-CCXT pro

  

-https://proxymesh.com/

  

-A server to deploy this to. I used AWS Lightsail. The basic tier is not powerful enough. Take the second smallest.

  

## How to run locally:

How to run locally:

  

Use Docker to provide you with mongo:

```

$ docker-compose up

  

$ yarn install

  

$ yarn run main_announcement

```

  

How to run on a server:

- Provision yourself a lightsail instance.

- Get all the third parties ready, and whitelist the APIs for those IPs.

- Run the setup.sh script in the root folder

- Run the commands contained in mongosetup.txt

  

## There are a few jobs that this can run:

  

- main_announcement : This is the main Binance API crawler. It does everything from monitoring the APIs to creating entries in mongo.

- main_dex_purchasing : This goes and analyses tokens, validates which chain they are on, and if its a good one, buys it on 0x. Originally it moved funds automatically to binance, but this is currently commented out and was executed as a manual step, because tokens can dump earlier than binance lists them and i wanted a kind of manual step where i can set limit order prices manually. This also triggers calls / SMS to twilio.

- main_selling: This sells tokens we moved on to binance.

- main_apicrawler: This is an experimental "dump all binance data" test app, which i used to try and find a new edge over competing bots. Sometimes it picks up listings 3 seconds faster than they do, but it's till too slow to be the absolute first. I suspect API leaks that I haven't spotted yet.

  
  

There are some more, but use them at your own risk. The arbitrage strategy is almost a surefire way to get rekt, mainly because CCXT only has a market ready to go about 0.4 seconds into a token pair launch, and others have proven that even 0.1 seconds is too late.

I have code in this repo that does millisecond timeclock alignment, so one could potentially attempt to send in the sale as very first, but you're competing against HFT bots here and its just too risky for me.

  
  

# Personal journey in this

  

## What did I learn?

- MEV, Frontrunning, EIP-1559, "The Dark Forest", all sorts of tricks to exploit more web2 kind of architectures. And all sorts of ins and outs about Binance.

  

## So why stop?

I currently no longer wish to live with alerts going off at 2AM potentially every day. It has conditioned my body to reflexively wake up around that time, and later as well, and I am currently enjoying the health benefits of not having such a fucked up circadian rhythm.

I've made some profits from this, but lost them in the recent bear by getting repeatedly stopped out and by making some poor investment choices. Since it currently requires thousands of dollars to outbid my nearest competitor in gas fees, i'm calling it quits as this is no longer EV+ for me.

Considering that even Cobie talked about this on uponly and he wrote about this in his article, plus given that now there is an OSS community building this, I no longer think it's fresh and cool, and It's transitioned to PvP instead of PvS.

  

Towards the end I kept getting outcompeted by this individual addy: 0x55659ddee6cb013c35301f6f3cc8482de857ea8e

https://etherscan.io/address/0x55659ddee6cb013c35301f6f3cc8482de857ea8e

  

If this is you, I'd like to congratulate you on your badassery. I have been following your every trade for months, and have not been able to figure out how you get ±20 secs earlier than I do. What a fucking chad.

  

## Share your personal goals, ser?

  

- *I am currently for hire, you can contact me at duckdegen@gmail.com or using this handle on the usual platforms*

- I have 10+ years experience in building software using JS/TS/node

- I have 2+ years of experience at selling Tech to large companies/corporates for projects > 1MM and speak to C levels regularly

- I speak 5 languages [EN, IT, DE, NL, FR] and am based in Central Europe

- I am interested in building DeFi platforms from a dev and a biz/partnership/integration perspective.

  
  
Shill me anything Web3 and I'll consider it.

  


Let's kick ass together.

  

Even tho i think NFTs will go to 0, lobsters are cool. 🦞 ❤️ ⚙️🧰

I will only accept payments in crypto.

  

## Do you feel the urge to send me some crypto? 
   Plz send donations to duckdegen.eth
