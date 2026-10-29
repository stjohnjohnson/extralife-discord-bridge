import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import { getUserInfo, getUserDonations } from './extralife.js';

let fetch;
beforeEach(() => { fetch = jest.spyOn(globalThis, 'fetch'); });
afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
});

test('reads participant information directly from the current host', async () => {
    const participant = { participantID: 12, displayName: 'Player', sumDonations: 1250.5, fundraisingGoal: 10000 };
    fetch.mockResolvedValue(new Response(JSON.stringify(participant)));

    await expect(getUserInfo(12)).resolves.toEqual(participant);
    expect(fetch).toHaveBeenCalledWith('https://dd.extra-life.org/api/participants/12?version=1.4',
        expect.objectContaining({ signal: expect.any(AbortSignal) }));
});

test('wraps the newest donation page without changing donation fields or order', async () => {
    const donations = [
        { donationID: 'd2', participantID: 12, amount: 25, displayName: 'Player', message: 'Good luck', createdDateUTC: '2026-10-28T12:00:00Z' },
        { donationID: 'd1', participantID: 12, amount: 10, message: null, createdDateUTC: '2026-10-27T12:00:00Z' }
    ];
    fetch.mockResolvedValue(new Response(JSON.stringify(donations)));

    await expect(getUserDonations(12)).resolves.toEqual({ donations });
    const [url, options] = fetch.mock.calls[0];
    const parsed = new URL(url);
    expect(parsed.origin).toBe('https://dd.extra-life.org');
    expect(parsed.pathname).toBe('/api/participants/12/donations');
    expect(Object.fromEntries(parsed.searchParams)).toEqual({
        version: '1.4', limit: '100', offset: '0', orderBy: 'createdDateUTC DESC, donationID DESC'
    });
    expect(options.signal).toBeInstanceOf(AbortSignal);
});

test('preserves an empty donation array', async () => {
    fetch.mockResolvedValue(new Response('[]'));
    await expect(getUserDonations(12)).resolves.toEqual({ donations: [] });
});

test('accepts a bodyless donation response without parsing JSON', async () => {
    const response = new Response(null, { status: 204 });
    const json = jest.spyOn(response, 'json');
    fetch.mockResolvedValue(response);
    await expect(getUserDonations(12)).resolves.toEqual({ donations: [] });
    expect(json).not.toHaveBeenCalled();
});

test('rejects a bodyless participant response', async () => {
    fetch.mockResolvedValue(new Response(null, { status: 204 }));
    await expect(getUserInfo(12)).rejects.toThrow('Extra Life API status 204');
});

test.each([null, [], 'invalid'])('rejects invalid participant response %j', async data => {
    fetch.mockResolvedValue(new Response(JSON.stringify(data)));
    await expect(getUserInfo(12)).rejects.toThrow('Invalid Extra Life participant response');
});

test.each([null, {}, 'invalid'])('rejects invalid donations response %j', async data => {
    fetch.mockResolvedValue(new Response(JSON.stringify(data)));
    await expect(getUserDonations(12)).rejects.toThrow('Invalid Extra Life donations response');
});

describe.each([
    ['participant', getUserInfo, { participantID: 12 }],
    ['donations', getUserDonations, []]
])('%s requests', (name, request, payload) => {
    test.each(['.', '..'])('rejects dot-only identifier %s before making a request', async id => {
        fetch.mockResolvedValue(new Response(JSON.stringify(payload)));
        await expect(request(id)).rejects.toThrow('Invalid Extra Life participant ID');
        expect(fetch).not.toHaveBeenCalled();
    });

    test('encodes identifiers as one path segment', async () => {
        fetch.mockResolvedValue(new Response(JSON.stringify(payload)));
        await request('12/34?other=1');
        const url = new URL(fetch.mock.calls[0][0]);
        expect(url.pathname).toBe('/api/participants/12%2F34%3Fother%3D1' + (name === 'donations' ? '/donations' : ''));
        expect(url.searchParams.has('other')).toBe(false);
        expect(url.searchParams.get('version')).toBe('1.4');
    });

    test('accepts numeric and string identifiers', async () => {
        fetch.mockImplementation(async () => new Response(JSON.stringify(payload)));
        await request(12);
        await request('12');
        expect(fetch.mock.calls[0][0]).toBe(fetch.mock.calls[1][0]);
    });

    test.each([304, 404, 412, 429, 500])('rejects HTTP status %i before parsing the body', async status => {
        const response = new Response(null, { status });
        const json = jest.spyOn(response, 'json');
        fetch.mockResolvedValue(response);
        await expect(request(12)).rejects.toThrow('Extra Life API status ' + status);
        expect(json).not.toHaveBeenCalled();
    });

    test('rejects malformed JSON', async () => {
        fetch.mockResolvedValue(new Response('<html>Unavailable</html>'));
        await expect(request(12)).rejects.toMatchObject({ name: 'SyntaxError' });
    });

    test('preserves network errors', async () => {
        const error = new Error('network unavailable');
        fetch.mockRejectedValue(error);
        await expect(request(12)).rejects.toBe(error);
    });

    test('aborts a request after ten seconds', async () => {
        jest.useFakeTimers();
        const timeout = jest.spyOn(AbortSignal, 'timeout').mockImplementation(ms => {
            const controller = new AbortController();
            setTimeout(() => controller.abort(new DOMException('Timed out', 'TimeoutError')), ms);
            return controller.signal;
        });
        fetch.mockImplementation((url, { signal }) => new Promise((resolve, reject) => {
            signal.addEventListener('abort', () => reject(signal.reason), { once: true });
        }));
        const result = request(12);
        const rejected = expect(result).rejects.toMatchObject({ name: 'TimeoutError' });
        await jest.advanceTimersByTimeAsync(9999);
        expect(fetch.mock.calls[0][1].signal.aborted).toBe(false);
        await jest.advanceTimersByTimeAsync(1);
        await rejected;
        expect(timeout).toHaveBeenCalledWith(10000);
    });
});
