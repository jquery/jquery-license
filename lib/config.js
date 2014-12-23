var path = require( "path" ),
	config = require( "../config" ),
	defaults = {
		owner: "jquery",
		port: 8000,
		repoDir: "repos",
		signatureRefresh: 60 * 1000
	};

// Fill in default values for the config
Object.keys( defaults ).forEach(function( key ) {
	if ( !config[ key ] ) {
		config[ key ] = defaults[ key ];
	}
});

// Force repo directory to be an absolute path
config.repoDir = path.resolve( __dirname, "..", config.repoDir );

module.exports = config;
