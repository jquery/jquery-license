var requestDebugger,
	Promise = require( "es6-promise" ).Promise,
	github = require( "github-request" ),
	createDebugger = require( "debug" ),
	config = require( "../config" );

requestDebugger = ( function() {
	var requestId = 0;
	return function() {
		return createDebugger( "github:" + ( ++requestId ) );
	};
} )();

module.exports = function( Repo ) {

Repo.prototype.request = function( options, data ) {
	var requestDebug = requestDebugger();
	options.path = "/repos/" + this.owner + "/" + this.name + options.path;

	if ( !options.headers ) {
		options.headers = {};
	}
	options.headers.Authorization = "token " + config.githubToken;

	requestDebug( "request", options, data );
	return new Promise( function( resolve, reject ) {
		github.request( options, data, function( error, data ) {
			if ( error ) {
				requestDebug( "error", error );
				return reject( error );
			}

			requestDebug( "success", data );
			resolve( data );
		} );
	} );
};

Repo.prototype.getPrCommitData = function( pr ) {
	return this.request( {
		path: "/pulls/" + pr
	} ).then( function( data ) {
		return {
			baseRemote: data.base.repo.git_url,
			baseBranch: data.base.ref,
			base: data.base.sha,
			headRemote: data.head.repo.git_url,
			headBranch: data.head.ref,
			head: data.head.sha
		};
	} );
};

Repo.prototype.setStatus = function( options ) {
	var data = {
		state: options.state,
		context: "JS Foundation CLA"
	};

	if ( options.url ) {
		data.target_url = options.url;
	}

	if ( options.description ) {
		data.description = options.description;
	}

	this.debug( "setting commit status", options );
	return this.request( {
		path: "/statuses/" + options.sha,
		method: "POST"
	}, data );
};

Repo.prototype.getLabels = function( options ) {
	var path = "/labels";
	if ( options ) {
		path = "/issues/" + ( options.issue || options.pr ) + "/labels";
	}
	path += "?per_page=100";
	return this.request( {
		path: path
	} );
};

Repo.prototype.createLabel = function( options ) {
	return this.request( {
		path: "/labels",
		method: "POST"
	}, {
		name: options.name,
		color: options.color || "ffffff"
	} );
};

Repo.prototype.addLabel = function( options ) {
	return this.request( {
		path: "/issues/" + ( options.issue || options.pr ) + "/labels",
		method: "POST"
	}, [ options.label ] );
};

Repo.prototype.removeLabel = function( options ) {
	return this.request( {
		path: "/issues/" + ( options.issue || options.pr ) + "/labels/" +
			encodeURI( options.label ),
		method: "DELETE"
	} );
};

Repo.prototype.addComment = function( options ) {
	return this.request( {
		path: "/issues/" + ( options.issue || options.pr ) + "/comments",
		method: "POST"
	}, {
		body: options.body
	} );
};

};
