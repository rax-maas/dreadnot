/**
 * New Relic agent configuration.
 */

/**
 * Get license key for Pipedrive machines from /etc/newrelic.key
 * If not present fallback to hardcoded key (for this version).
 */

var appName = 'dreadnot',
	util = require('pipedrive-newrelic/util'),
	licenseKey = util.newrelicKey,
	nodeEnv = process.env.NODE_ENV || 'dev';

if (nodeEnv !== 'live') {
	appName += ' (' + nodeEnv + ')';
}

exports.config = {
	/**
	 * Array of application names.
	 */
	app_name: [appName],
	/**
	 * Your New Relic license key.
	 */
	license_key: licenseKey,
	logging: {
		/**
		 * Level at which to log. 'trace' is most useful to New Relic when diagnosing
		 * issues with the agent, 'info' and higher will impose the least overhead on
		 * production applications.
		 */
		level: nodeEnv === 'live' ? 'info' : 'trace',
		/**
		 * Path to write logfile
		 */
		filepath: '/var/log/dreadnot/newrelic_agent.log'
	}
};