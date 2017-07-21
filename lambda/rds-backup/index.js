var AWS = require('aws-sdk');
var rds = new AWS.RDS();

//=============HELPERS==============
var copyDBSnapshots = function(allSnapshots) {

  var autoSnapshots = allSnapshots.filter(function (s) { return s.SnapshotType === 'automated' });
  var manualSnapshots = allSnapshots.filter(function (s) { return s.SnapshotType === 'manual' });
  var manualSnapshotIds = manualSnapshots.map(function(s) { return s.DBSnapshotIdentifier });

  autoSnapshots.map(function(snapshot) {
    var id = snapshot.DBSnapshotIdentifier;
    var newId = 'backup-' + snapshot.DBSnapshotIdentifier.split('-').slice(1).join('-');

    if (manualSnapshotIds.includes(newId)) {
      console.log('Snapshot ' + newId + ' already exists; skipping.');
      return;
    }

    var params = {
      SourceDBSnapshotIdentifier: id,
      TargetDBSnapshotIdentifier: newId
    };

    console.log('Copying automated snapshot id ' + id + ` to manual snapshot id ` + newId);
    rds.copyDBSnapshot(params, function(err, data) {
      if (err) console.log(err, err.stack);
      else     console.log(data);
    });
  });
};

// =============LOGIC===============
AWS.config.update({region: 'us-east-1'});

console.log('Loading function...');

exports.handler = function(event, context) {
  var params = {
    DBInstanceIdentifier: event.DBInstanceIdentifier
  };

  console.log('Describing DB Snapshots...');
  rds.describeDBSnapshots(params, function(err, data) {
    if (err) console.log(err, err.stack);
    else {
        copyDBSnapshots(data.DBSnapshots);
    }
  });
};
