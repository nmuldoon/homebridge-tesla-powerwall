/**
 * Checks if an error is given and prints it and returns true.
 * Otherwise it just returns false.
 *
 * @param {string} error Error object returned by fetch.
 * @param {response} response Response object returned by fetch.
 * @param {string} body Body returned by fetch.
 * @param {boolean} cached Whether the response has been delivered from cache.
 */
module.exports = function(log, error, response, body, cached) {
    if (error) {
        if (!cached) {
            log('Request failed:', error);
        }
        return true;
    }
    if (response && response.status >= 300) {
        if (!cached) {
            try {
                var jsonBody = JSON.parse(body);
                if (jsonBody.message) {
                    log('Unexpected response:', response.status, jsonBody.message);
                    return true;
                }
            } catch (jsonError) {

            }
            log('Unexpected response:', response.status, body);
        }
        return true;
    }

    if (!cached) {
        log.debug('error:', error);
        log.debug('status code:', response && response.status);
        log.debug('body:', body);
    }

    return false;
};
