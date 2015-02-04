var fs = require( "fs" ),
	Promise = require( "es6-promise" ).Promise,
	mkdirp = require( "mkdirp" ),
	config = require( "./config" ),
	Repo = require( "./repo");

function Audit( options ) {
	if ( !options.repo ) {
		throw new Error( "Missing required option: repo." );
	}
	if ( !options.pr ) {
		throw new Error( "Missing required option: pr." );
	}

	this.options = options;
	this.repo = new Repo( options.repo );
}

Audit.prototype.ensureRange = function() {
	if ( this.options.base && this.options.head ) {
		return Promise.resolve();
	}

	var options = this.options;
	return this.repo.getPrCommitRange( this.options.pr )
		.then(function( range ) {
			options.base = range.base;
			options.head = range.head;
		});
};

Audit.prototype.setPending = function() {
	return this.repo.setStatus({
		state: "pending",
		sha: this.options.head
	});
};

Audit.prototype.determineAuditState = function() {
	return this.repo.auditPr( this.options )
		.then(function( data ) {
			return {
				data: data,
				state: data.neglectedAuthors.length ? "failure" : "success"
			};
		})
		.catch(function( error ) {
			return {
				error: error,
				state: "error"
			};
		});
};

Audit.prototype.audit = function() {
	return this.ensureRange()
		.then( this._audit.bind( this ) );
};

Audit.prototype.ensureClaLabels = function() {
	var repo = this.repo;

	function ensureLabel( labels, name ) {
		var existingLabel = labels.filter(function( label ) {
			return label.name === name;
		})[ 0 ];

		if ( existingLabel ) {
			return existingLabel;
		}

		return repo.createLabel({ name: name });
	}

	return this.repo.getLabels()
		.then(function( labels ) {
			return Promise.all([
				ensureLabel( labels, "CLA: Valid" ),
				ensureLabel( labels, "CLA: Error" )
			]);
		})
		.then(function( labels ) {
			return {
				valid: labels[ 0 ],
				error: labels[ 1 ]
			};
		});
};

Audit.prototype._audit = function() {
	return Promise.all([
		this.determineAuditState(),
		this.ensureClaLabels(),
		this.setPending()
	]).then( this.finishAudit.bind( this ) );
};

Audit.prototype.applyLabels = function( labels, state ) {
	var addLabel, removeLabel;

	if ( state === "success" ) {
		addLabel = labels.valid.name;
		removeLabel = labels.error.name;
	} else {
		addLabel = labels.error.name;
		removeLabel = labels.valid.name;
	}

	return Promise.all([
		this.repo.addLabel({
			pr: this.options.pr,
			label: addLabel
		}),
		this.repo.removeLabel({
			pr: this.options.pr,
			label: removeLabel
		})
	]);
};

Audit.prototype.logResult = function( result ) {
	var directory = config.outputDir + "/" + this.options.repo + "/" +
			this.options.head.substring( 0, 2 ),
		filename = directory + "/" + this.options.head + ".json",
		repo = this.repo;

	return new Promise(function( resolve, reject ) {
		mkdirp( directory, "0755", function( error ) {
			if ( error ) {
				return reject( error );
			}

			fs.writeFile( filename, JSON.stringify( result.data ), function( error ) {
				if ( error ) {
					return reject( error );
				}

				resolve( filename );
			});
		});
	});
};

Audit.prototype.finishAudit = function( values ) {
	var result = values[ 0 ],
		labels = values[ 1 ],
		status = {
			sha: this.options.head,
			state: result.state
		};

	return Promise.all([
		this.logResult( result ),
		this.repo.setStatus( status ),
		this.applyLabels( labels, result.state )
	])
		.then(function() {
			return status;
		});
};

exports.audit = function( options ) {
	var audit;

	try {
		audit = new Audit( options );
	} catch( error ) {
		return Promise.reject( error );
	}

	return audit.audit();
};
