var createDebugger = require( "debug" ),
	config = require( "./config" );

function Repo( name ) {
	this.name = name;
	this.path = config.repoDir + "/" + name;
	this.remoteUrl = "git://github.com/" + config.owner + "/" + name + ".git";
	this.debug = createDebugger( "repo:" + name );
}

Repo.get = ( function() {
	var repos = {};

	return function( name ) {
		if ( !repos.hasOwnProperty( name ) ) {
			repos[ name ] = new Repo( name );
		}

		return repos[ name ];
	};
} )();

require( "./repo/audit" )( Repo );
require( "./repo/fetch" )( Repo );
require( "./repo/github" )( Repo );

module.exports = Repo;
