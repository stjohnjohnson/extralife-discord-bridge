const PARTICIPANTS = 'https://dd.extra-life.org/api/participants/';

function participantEndpoint(participantId) {
    const id = String(participantId);
    if (id === '.' || id === '..') throw new Error('Invalid Extra Life participant ID');
    return PARTICIPANTS + encodeURIComponent(id);
}

async function request(url, allowNoContent = false) {
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (allowNoContent && response.status === 204) return [];
    if (response.status !== 200) throw new Error('Extra Life API status ' + response.status);
    return response.json();
}

export async function getUserInfo(participantId) {
    const data = await request(participantEndpoint(participantId) + '?version=1.4');
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw new Error('Invalid Extra Life participant response');
    }
    return data;
}

export async function getUserDonations(participantId) {
    const query = new URLSearchParams({
        version: '1.4',
        limit: '100',
        offset: '0',
        orderBy: 'createdDateUTC DESC, donationID DESC'
    });
    const donations = await request(participantEndpoint(participantId) + '/donations?' + query, true);
    if (!Array.isArray(donations)) throw new Error('Invalid Extra Life donations response');
    return { donations };
}
