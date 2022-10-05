import { getUserInfo, getUserDonations } from 'extra-life-api';
import dotenv from 'dotenv';
import { Client, GatewayIntentBits } from 'discord.js';
import 'log-timestamp';

// Load config from disk
dotenv.config();

// Validate we have all the required variables
const configErrors = [
    'DISCORD_SUMMARY_CHANNEL',  // Discord channel ID for updating the title
    'DISCORD_DONATION_CHANNEL', // Discord channel ID for listing donations
    'DISCORD_TOKEN',            // Bot token to talk to Discord
    'EXTRALIFE_PARTICIPANT_ID'  // Participant ID for Extra Life
].map(key => {
    if (!process.env[key]) {
        return `${key} is a required environment variable`;
    }
}).join("\n").trim();
if (configErrors != "") {
    console.error(configErrors);
    process.exit(1);
}

var donationChannel, summaryChannel;

// Track all "seen" donations
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

        if (msgQueue.length > 0) {
            if (!silent) {
                msgQueue.forEach(msg => donationChannel.send(msg));
            }

            // Update summary
            getUserInfo(process.env.EXTRALIFE_PARTICIPANT_ID).then(data => {
                const sumDonations = moneyFormatter.format(data.sumDonations),
                    percentComplete = Math.round(data.sumDonations / data.fundraisingGoal * 100),
                    summary = `${sumDonations} (${percentComplete}%) Raised`;

                console.log(`Updating status: "${summary}"`)
                return summaryChannel.setName(summary);
            });
        }
    }).catch(err => {
        console.error("Error getting Donations:", err);
    });
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

    // Find our channels
    donationChannel = client.channels.cache.get(`${process.env.DISCORD_DONATION_CHANNEL}`);
    if (!donationChannel) {
        throw new Error(`Unable to find donation channel with id ${process.env.DISCORD_DONATION_CHANNEL}`);
    }
    console.log(`Found Donation Channel: ${donationChannel.id}`);

    summaryChannel = client.channels.cache.get(`${process.env.DISCORD_SUMMARY_CHANNEL}`);
    if (!summaryChannel) {
        throw new Error(`Unable to find summary channel with id ${process.env.DISCORD_SUMMARY_CHANNEL}`);
    }
    console.log(`Found Summary Channel: ${summaryChannel.id}`);

    // Check for updates (regularly)
    setInterval(getLatestDonation, 30000);
    // Be quiet the first time
    getLatestDonation(true);
});

// Login to Discord with your client's token
client.login(`${process.env.DISCORD_TOKEN}`);
