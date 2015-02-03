var Promise = require( "es6-promise" ).Promise,
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
			return data.neglectedAuthors.length ? "failure" : "success";
		})
		.catch(function( error ) {
			return "error";
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
	]).then( this.updatePr.bind( this ) );
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

Audit.prototype.updatePr = function( values ) {
	var state = values[ 0 ],
		labels = values[ 1 ],
		status = {
			sha: this.options.head,
			state: state
		};

	return Promise.all([
		this.repo.setStatus( status ),
		this.applyLabels( labels, state )
	])
		.then(function() {
			return status;
		});
};

exports.audit = function( options ) {
	var audit = new Audit( options );
	return audit.audit();
};
