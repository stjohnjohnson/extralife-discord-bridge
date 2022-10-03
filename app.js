import { getUserInfo, getUserDonations } from 'extra-life-api';
import dotenv, { config } from 'dotenv';
import { Client, GatewayIntentBits } from 'discord.js';
import 'log-timestamp';

// Load config from disk
dotenv.config();

// Validate we have all the required variables
const configErrors = ['DISCORD_CHANNEL', 'DISCORD_TOKEN', 'EXTRALIFE_PARTICIPANT_ID'].map(key => {
    if (!process.env[key]) {
        return `${key} is a required environment variable`;
    }
}).join("\n").trim();
if (configErrors != "") {
    console.error(configErrors);
    process.exit(1);
}

var channel;

var seenDonationIDs = {};
function getLatestDonation(silent = false) {
    getUserDonations(process.env.EXTRALIFE_PARTICIPANT_ID).then(data => {
        var msgQueue = [];

        data.donations.map(donation => {
            if (seenDonationIDs[donation.donationID]) {
                return;
            }
            seenDonationIDs[donation.donationID] = true;

            const amount = moneyFormatter.format(donation.amount),
                displayName = donation.displayName ? donation.displayName : 'Anonymous',
                message = donation.message ? ` with the message "${donation.message}"` : '';;

            msgQueue.unshift(`${displayName} just donated ${amount}${message}!`);
            console.log(`Donation: ${displayName} / ${amount}${message}`);
        });

        if (!silent) {
            msgQueue.forEach(msg => channel.send(msg));
        }
    }).catch(err => {
        console.error("Error getting Donations:", err);
    })
}

// Setup a formatter
const moneyFormatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
});

// Create a new client instance
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// When the client is ready, run this code (only once)
client.once('ready', () => {
    console.log('Bot Online');

    // Find our channel
    channel = client.channels.cache.find(channel => channel.name === `${process.env.DISCORD_CHANNEL}`);
    if (!channel) {
        throw new Error(`Unable to find channel with name ${process.env.DISCORD_CHANNEL}`);
    }
    console.log(`Found Channel: ${channel.id}`);

    // Check for updates (regularly)
    setInterval(getLatestDonation, 30000);
    // Be quiet the first time
    getLatestDonation(true);
});

// Login to Discord with your client's token
client.login(`${process.env.DISCORD_TOKEN}`);
