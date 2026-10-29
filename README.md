# extralife-discord-bridge
Bring your Extra-Life donations directly to your Discord channel

## Running

```bash
$ docker run --rm -it --env-file .env stjohnjohnson/extralife-discord-bridge:latest
> extralife-discord-bridge@2.0.0 start
> node app.js

[2022-10-05T06:22:08.636Z] Bot Online
[2022-10-05T06:22:08.637Z] Found Donation Channel: 1026381181073240134
[2022-10-05T06:22:08.638Z] Found Summary Channel: 1026899238338179182
[2022-10-05T06:22:42.594Z] Donation: St. John Johnson / $31.00
```

## Configuration

Set the following environment variables:

- `DISCORD_TOKEN`: Your Bot Token
- `DISCORD_DONATION_CHANNEL`: ID of the channel to write donations to
- `DISCORD_SUMMARY_CHANNEL`: ID of the channel to update the title of
- `EXTRALIFE_PARTICIPANT_ID`: Participant ID from Extra Life

### Discord Bot

The Discord bot requires `Send Messages` and `Manage Channel` permissions.

## Features

Every 30s the bot checks ExtraLife to see if there are any donations for that participant.

The bot calls `https://dd.extra-life.org/api/participants/` directly using
DonorDrive API version `1.4`. Each request times out after 10 seconds; failures
are logged and the bot checks again on its next scheduled poll. No additional
configuration is required.

### Donation Stream

If there are new donations, it posts them in the channel you specified.

Each poll reads the latest 100 donations. Donations present at startup are
recorded silently, and each new donation is announced once while the bot runs.
Donation history is kept in memory, so the bot does not catch up on donations
received while it was stopped.

### Summary Channel

After each donation, the bot also updates the specified channel title to show the total & percent raised.
