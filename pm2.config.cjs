module.exports = {
    apps: [{
      name: "polymarket-tg-bot",
      script: "telegram.ts",
      interpreter: "bun",
      env: {
        PATH: `${process.env.HOME}/.bun/bin:${process.env.PATH}`,
        ENV: "production",
      }
    }]
  };
  