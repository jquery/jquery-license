var path = require( "path" ),
	debug = require( "debug" )( "config" ),
	config = require( "../config" ),
	defaults = {
		owner: "jquery",
		port: 8000,
		repoDir: "repos",
		outputDir: "output",
		signatureRefresh: 60 * 1000
	};

// Fill in default values for the config
Object.keys( defaults ).forEach(function( key ) {
	if ( !config[ key ] ) {
		config[ key ] = defaults[ key ];
	}
});

// Force directories to use absolute paths
config.repoDir = path.resolve( __dirname, "..", config.repoDir );
config.outputDir = path.resolve( __dirname, "..", config.outputDir );

debug( config );
module.exports = config;
