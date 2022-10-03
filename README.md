# extralife-discord-bridge
Bring your Extra-Life donations directly to your Discord channel

## Running

```bash
$ docker run --rm -it --env-file .env stjohnjohnson/extralife-discord-bridge:latest
> extralife-discord-bridge@1.0.0 start
> node app.js

[2022-10-03T07:00:42.180Z] Bot Online
[2022-10-03T07:00:42.181Z] Found Channel: 1026381181073240134
[2022-10-03T07:00:42.594Z] Donation: St. John Johnson / $31.00
```

## Configuration

Set the following environment variables:

- `DISCORD_TOKEN`: Your Bot Token
- `DISCORD_CHANNEL`: Name of the channel to write to
- `EXTRALIFE_PARTICIPANT_ID`: Participant ID from Extra Life

## Features

Every 30s the bot checks ExtraLife to see if there are any donations for that participant.  If so, it posts them in the channel you specified.