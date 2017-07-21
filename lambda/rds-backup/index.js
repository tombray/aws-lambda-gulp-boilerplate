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
console.log('Loading function...');

exports.handler = function(event, context) {
  AWS.config.update({region: event.region});

  console.log('Getting all DB instances...');
  rds.describeDBInstances({}, function(err, data) {
    if (err) console.log(err, err.stack);
    else {

      if (!data.DBInstances) {
        console.log('No DB instances available; exiting.');
        return;
      } else {
        console.log('Instances found: ' + data.DBInstances.map(i => i.DBInstanceIdentifier));
      }

      // map over db instances and grab tags for each
      data.DBInstances.map(function(DBInstance) {
        var dbId = DBInstance.DBInstanceIdentifier;

        console.log('Getting tags for id: ' + dbId);

        var params = {
          ResourceName: DBInstance.DBInstanceArn
        };
        rds.listTagsForResource(params, function(err, data) {
          if (err) console.log(err, err.stack);
          else {
            // if tags contain backup tag, copy snapshots for this db
            if (!data.TagList) {
              console.log('No tags found; skipping id: ' + dbId);
              return;
            }
            var backupTag = data.TagList.filter (tag => tag === {Key: 'backup', Value: 'true'});
            if (backupTag.length === 0) {
              console.log('This instance is not tagged with {backup: true}; skipping id: ' + dbId);
              return;
            }
            var params = {
              DBInstanceIdentifier: dbId
            }
            rds.describeDBSnapshots(params, function(err, data) {
              var params = {
                DBInstanceIdentifier:  dbId
              };
              if (err) console.log(err, err.stack);
              else {
                copyDBSnapshots(data.DBSnapshots);
              }
            });
          }
        });
      })
    }
  });
};
