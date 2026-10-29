import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';

let getUserDonations, getUserInfo, send, setName, ready, poll;
const originalEnv = process.env;

// Complete the app's donation and nested summary promise chains without real timers.
async function flushRequests() {
    for (let i = 0; i < 8; i++) await Promise.resolve();
}

beforeEach(async () => {
    jest.resetModules();
    process.env = {
        ...originalEnv,
        DISCORD_DONATION_CHANNEL: 'donations', DISCORD_SUMMARY_CHANNEL: 'summary',
        DISCORD_TOKEN: 'test-token', EXTRALIFE_PARTICIPANT_ID: '12'
    };
    getUserDonations = jest.fn().mockResolvedValue({ donations: [] });
    getUserInfo = jest.fn().mockResolvedValue({ sumDonations: 25, fundraisingGoal: 100 });
    send = jest.fn().mockResolvedValue(undefined);
    setName = jest.fn().mockResolvedValue(undefined);
    const client = {
        once: jest.fn((event, callback) => { ready = callback; }),
        login: jest.fn().mockResolvedValue(undefined),
        channels: { cache: new Map([
            ['donations', { id: 'donations', send }], ['summary', { id: 'summary', setName }]
        ]) }
    };
    jest.spyOn(globalThis, 'setInterval').mockImplementation(callback => { poll = callback; return 1; });
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.unstable_mockModule('./extralife.js', () => ({ getUserDonations, getUserInfo }));
    jest.unstable_mockModule('dotenv', () => ({ default: { config: jest.fn() } }));
    jest.unstable_mockModule('log-timestamp', () => ({}));
    jest.unstable_mockModule('discord.js', () => ({
        Client: jest.fn().mockImplementation(function () { return client; }),
        GatewayIntentBits: { Guilds: 1 }
    }));
    await import('./app.js');
    expect(client.login).toHaveBeenCalledWith('test-token');
});

afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
});

test('startup suppresses existing donations and updates the summary', async () => {
    getUserDonations.mockResolvedValue({ donations: [{ donationID: 'old', amount: 25 }] });
    ready();
    await flushRequests();
    expect(setInterval).toHaveBeenCalledWith(expect.any(Function), 30000);
    expect(getUserDonations).toHaveBeenCalledWith('12');
    expect(send).not.toHaveBeenCalled();
    expect(getUserInfo).toHaveBeenCalledWith('12');
    expect(setName).toHaveBeenCalledWith('$25.00 (25%) Raised');
});

test('announces only unseen donations across repeated polls', async () => {
    const old = { donationID: 'old', amount: 25 };
    getUserDonations.mockResolvedValueOnce({ donations: [old] });
    ready();
    await flushRequests();
    getUserDonations.mockResolvedValue({ donations: [{ donationID: 'new', amount: 10, displayName: 'Player' }, old] });
    getUserInfo.mockResolvedValue({ sumDonations: 35, fundraisingGoal: 100 });
    poll();
    await flushRequests();
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith('Player just donated $10.00!');
    expect(setName).toHaveBeenLastCalledWith('$35.00 (35%) Raised');
    expect(setName).toHaveBeenCalledTimes(2);
    poll();
    await flushRequests();
    expect(send).toHaveBeenCalledTimes(1);
    expect(getUserInfo).toHaveBeenCalledTimes(2);
    expect(setName).toHaveBeenCalledTimes(2);
});

test('preserves donor messages, anonymous fallback and oldest-first announcement order', async () => {
    ready();
    await flushRequests();
    getUserDonations.mockResolvedValue({ donations: [
        { donationID: 'newer', amount: 1250.5, displayName: 'Player', message: 'Good luck' },
        { donationID: 'older', amount: 10, displayName: '', message: null }
    ] });
    poll();
    await flushRequests();
    expect(send.mock.calls).toEqual([
        ['Anonymous just donated $10.00!'],
        ['Player just donated $1,250.50 with the message "Good luck"!']
    ]);
});

test('ignores empty startup and subsequent donation pages', async () => {
    ready();
    await flushRequests();
    poll();
    await flushRequests();
    expect(getUserDonations).toHaveBeenCalledTimes(2);
    expect(send).not.toHaveBeenCalled();
    expect(getUserInfo).not.toHaveBeenCalled();
    expect(setName).not.toHaveBeenCalled();
});

test('recovers on the next poll after a donation API failure', async () => {
    ready();
    await flushRequests();
    const error = new Error('Extra Life API status 500');
    getUserDonations.mockRejectedValueOnce(error);
    poll();
    await flushRequests();
    expect(console.error).toHaveBeenCalledWith('Error getting Donations:', error);
    expect(send).not.toHaveBeenCalled();
    getUserDonations.mockResolvedValue({ donations: [{ donationID: 'new', amount: 25 }] });
    poll();
    await flushRequests();
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith('Anonymous just donated $25.00!');
});

test('continues polling after a summary API failure', async () => {
    ready();
    await flushRequests();
    const error = new Error('Extra Life API status 429');
    getUserInfo.mockRejectedValueOnce(error);
    getUserDonations.mockResolvedValueOnce({ donations: [{ donationID: 'first', amount: 25 }] });
    poll();
    await flushRequests();
    expect(console.error).toHaveBeenCalledWith('Error getting User Info:', error);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith('Anonymous just donated $25.00!');
    getUserDonations.mockResolvedValueOnce({ donations: [{ donationID: 'second', amount: 10 }] });
    poll();
    await flushRequests();
    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenLastCalledWith('Anonymous just donated $10.00!');
    expect(setName).toHaveBeenCalledTimes(1);
});
