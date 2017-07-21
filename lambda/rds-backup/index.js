const AWS = require('aws-sdk');
const rds = new AWS.RDS();

//=============HELPERS==============
const copyDBSnapshots = allSnapshots => {

  const autoSnapshots = allSnapshots.filter(s => s.SnapshotType === 'automated');
  const manualSnapshots = allSnapshots.filter(s => s.SnapshotType === 'manual');
  const manualSnapshotIds = manualSnapshots.map(s => s.DBSnapshotIdentifier);

  autoSnapshots.map(snapshot => {
    const id = snapshot.DBSnapshotIdentifier;
    const newId = 'backup-' + snapshot.DBSnapshotIdentifier.split('-').slice(1).join('-');

    if (manualSnapshotIds.includes(newId)) {
      console.log('Snapshot ' + newId + ' already exists; skipping.');
      return;
    }

    const params = {
      SourceDBSnapshotIdentifier: id,
      TargetDBSnapshotIdentifier: newId
    };

    console.log('Copying automated snapshot id ' + id + ` to manual snapshot id ` + newId);
    rds.copyDBSnapshot(params, (err, data) => {
      if (err) console.log(err, err.stack);
      else     console.log(data);
    });
  });
};

// =============LOGIC===============
console.log('Loading function...');

exports.handler = (event, context) => {
  AWS.config.update({region: event.region});

  console.log('Getting all DB instances...');
  rds.describeDBInstances({}, (err, data) => {
    if (err) console.log(err, err.stack);
    else {

      if (!data.DBInstances) {
        console.log('No DB instances available; exiting.');
        return;
      } else {
        console.log('Instances found: ' + data.DBInstances.map(i => i.DBInstanceIdentifier));
      }

      // map over db instances and grab tags for each
      data.DBInstances.map(DBInstance => {
        const dbId = DBInstance.DBInstanceIdentifier;

        console.log('Getting tags for id: ' + dbId);

        const params = {
          ResourceName: DBInstance.DBInstanceArn
        };
        rds.listTagsForResource(params, (err, data) => {
          if (err) console.log(err, err.stack);
          else {
            // if tags contain backup tag, copy snapshots for this db
            if (!data.TagList) {
              console.log('No tags found; skipping id: ' + dbId);
              return;
            }
            const backupTag = data.TagList.filter (tag => tag === {Key: 'backup', Value: 'true'});
            if (backupTag.length === 0) {
              console.log('This instance is not tagged with {backup: true}; skipping id: ' + dbId);
              return;
            }
            const params = {
              DBInstanceIdentifier: dbId
            };
            rds.describeDBSnapshots(params, (err, data) => {
              const params = {
                DBInstanceIdentifier:  dbId
              };
              if (err) console.log(err, err.stack);
              else {
                copyDBSnapshots(data.DBSnapshots);
              }
            });
          }
        });
      });
    }
  });
};
