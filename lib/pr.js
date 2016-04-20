var fs = require( "fs" );
var querystring = require( "querystring" );
var Promise = require( "es6-promise" ).Promise;
var mkdirp = require( "mkdirp" );
var createDebugger = require( "debug" );
var config = require( "./config" );
var Repo = require( "./repo" );
var handlebars = require( "handlebars" );
var commentTemplate = handlebars.compile( fs.readFileSync( __dirname + "/comment.hbs", "utf-8" ) );

function Audit( options ) {
	if ( !options.owner ) {
		throw new Error( "Missing required option: owner." );
	}
	if ( !options.repo ) {
		throw new Error( "Missing required option: repo." );
	}
	if ( !options.pr ) {
		throw new Error( "Missing required option: pr." );
	}

	this.options = options;
	this.repo = Repo.get( options.owner, options.repo );
	this.debug = createDebugger( "audit:" + options.owner + "/" + options.repo + "-" + options.pr );
}

Audit.prototype.ensureCommitData = function() {
	if ( this.options.headRemote && this.options.headBranch && this.options.head &&
			this.options.baseBranch && this.options.base ) {
		return Promise.resolve();
	}

	var options = this.options;
	return this.repo.getPrCommitData( this.options.pr )
		.then( function( data ) {
			Object.keys( data ).forEach( function( property ) {
				options[ property ] = data[ property ];
			} );
		} );
};

Audit.prototype.setPending = function() {
	this.debug( "setting state to pending", this.options.head );
	return this.repo.setStatus( {
		state: "pending",
		sha: this.options.head
	} );
};

Audit.prototype.determineAuditState = function() {
	this.debug( "running audit" );
	return this.repo.auditPr( this.options )
		.then( function( data ) {
			var neglectedAuthorCount = data.neglectedAuthors.length;

			if ( neglectedAuthorCount ) {
				return {
					data: data,
					state: "failure",
					description: neglectedAuthorCount === 1 ?
						"One author has not signed the CLA" :
						neglectedAuthorCount + " authors have not signed the CLA"
				};
			}

			return {
				data: data,
				state: "success",
				description: "All authors have signed the CLA"
			};
		} )
		.catch( function( error ) {
			return {
				error: error,
				state: "error",
				description: "There was an error checking the CLA status"
			};
		} );
};

Audit.prototype.audit = function() {
	return this.ensureCommitData()
		.then( this._audit.bind( this ) );
};

Audit.prototype.ensureClaLabels = function() {
	var repo = this.repo,
		debug = this.debug;

	debug( "ensuring CLA labels exist" );

	function ensureLabel( labels, name, color ) {
		var lowerName = name.toLowerCase();

		var existingLabel = labels.filter( function( label ) {
			return label.name.toLowerCase() === lowerName;
		} )[ 0 ];

		if ( existingLabel ) {
			debug( "label for \"" + name + "\" exists" );
			return existingLabel;
		}

		debug( "creating label for \"" + name + "\"" );
		return repo.createLabel( { name: name, color: color } );
	}

	return this.repo.getLabels()
		.then( function( labels ) {
			return Promise.all( [
				ensureLabel( labels, "CLA: Valid", "007700" ),
				ensureLabel( labels, "CLA: Error", "770000" )
			] );
		} )
		.then( function( labels ) {
			return {
				valid: labels[ 0 ],
				error: labels[ 1 ]
			};
		} );
};

Audit.prototype._audit = function() {
	return Promise.all( [
		this.determineAuditState(),
		this.ensureClaLabels(),
		this.setPending()
	] ).then( this.finishAudit.bind( this ) );
};

Audit.prototype.applyLabels = function( labels, state ) {
	var addLabel, removeLabel,
		audit = this,
		pr = this.options.pr;

	if ( state === "success" ) {
		addLabel = labels.valid.name;
		removeLabel = labels.error.name;
	} else {
		addLabel = labels.error.name;
		removeLabel = labels.valid.name;
	}

	this.debug( "checking labels on PR #" + pr );
	return this.repo.getLabels( { pr: pr } )
		.then( function( labels ) {
			var ops = [],
				labelNames = labels.map( function( label ) {
					return label.name;
				} );

			if ( labelNames.indexOf( addLabel ) === -1 ) {
				audit.debug( "adding label " + addLabel + " to PR #" + pr );
				ops.push( audit.repo.addLabel( {
					pr: pr,
					label: addLabel
				} ) );
			}
			if ( labelNames.indexOf( removeLabel ) !== -1 ) {
				audit.debug( "removing label " + removeLabel + " from PR #" + pr );
				ops.push( audit.repo.removeLabel( {
					pr: pr,
					label: removeLabel
				} ) );
			}
			audit.debug( "doing " + ops.length + " label operations" );
			return Promise.all( ops );
		} );
};

Audit.prototype.logResult = function( result ) {
	var directory = config.outputDir + "/" + this.options.owner + "/" + this.options.repo + "/" +
			this.options.head.substring( 0, 2 ),
		filename = directory + "/" + this.options.head + ".json",
		debug = this.debug;

	this.debug( "logging results to disk", filename );
	return new Promise( function( resolve, reject ) {
		mkdirp( directory, "0755", function( error ) {
			if ( error ) {
				debug( "error creating path", error );
				return reject( error );
			}

			var data = JSON.stringify( result, function( key, value ) {
				if ( key === "error" ) {
					return value.stack;
				}

				return value;
			} );

			fs.writeFile( filename, data, function( error ) {
				if ( error ) {
					debug( "error writing to disk", error );
					return reject( error );
				}

				debug( "successfully logged results to disk" );
				resolve( filename );
			} );
		} );
	} );
};

Audit.prototype.postComment = function() {

	// Only post comment on new PRs
	if ( this.options.action !== "opened" ) {
		return;
	}

	return this.repo.addComment( {
		pr: this.options.pr,
		body: commentTemplate( this.options )
	} );
};

Audit.prototype.finishAudit = function( values ) {
	var result = values[ 0 ],
		labels = values[ 1 ],
		status = {
			sha: this.options.head,
			state: result.state,
			url: "http://contribute.jquery.org/CLA/status/?" + querystring.stringify( {
				owner: this.options.owner,
				repo: this.options.repo,
				sha: this.options.head
			} ),
			description: result.description
		};

	return Promise.all( [
		this.logResult( result ),
		this.repo.setStatus( status ),
		this.applyLabels( labels, result.state ),
		result.state === "failure" ? this.postComment() : undefined
	] )
		.then( function() {

			// Errors in the actual audit essentially get swallowed, so we expose it here
			if ( result.error ) {
				status.auditError = result.error;
			}

			return status;
		} );
};

exports.audit = function( options ) {
	var audit;

	try {
		audit = new Audit( options );
	} catch ( error ) {
		return Promise.reject( error );
	}

	return audit.audit();
};
