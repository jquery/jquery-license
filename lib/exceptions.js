var fs = require( "fs" ),
	path = require( "path" );

fs.readdirSync( __dirname + "/../exceptions" ).forEach( function( file ) {
	var repo = path.basename( file, ".js" );
	exports[ repo ] = require( "../exceptions/" + repo );
} );
