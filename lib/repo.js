var createDebugger = require( "debug" ),
	config = require( "./config" );

function Repo( owner, name ) {
	this.owner = owner;
	this.name = name;
	this.path = config.repoDir + "/" + name;
	this.remoteUrl = "git://github.com/" + owner + "/" + name + ".git";
	this.debug = createDebugger( "repo:" + name );
}

Repo.get = ( function() {
	var repos = {};

	return function( owner, name ) {
		if ( !owner ) {
			throw new Error( "Missing required 'owner' argument" );
		}

		if ( !name ) {
			throw new Error( "Missing required 'name' argument" );
		}

		var id = owner + "/" + name;
		if ( !repos.hasOwnProperty( id ) ) {
			repos[ id ] = new Repo( owner, name );
		}

		return repos[ id ];
	};
} )();

require( "./repo/audit" )( Repo );
require( "./repo/fetch" )( Repo );
require( "./repo/github" )( Repo );

module.exports = Repo;
