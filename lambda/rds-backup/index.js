const AWS = require('aws-sdk');
const rds = new AWS.RDS();

//=============HELPERS==============
const copyDBSnapshots = allSnapshots => {

  const autoSnapshots = allSnapshots.filter(s => s.SnapshotType === 'automated');
  const manualSnapshots = allSnapshots.filter(s => s.SnapshotType === 'manual');
  const manualSnapshotIds = manualSnapshots.map(s => s.DBSnapshotIdentifier);

  autoSnapshots.map(snapshot => {
    const id = snapshot.DBSnapshotIdentifier;
    const backupId = snapshot.DBSnapshotIdentifier.split('rds:').slice(1).join('-') + '-backup';

    if (manualSnapshotIds.includes(backupId)) {
      console.log('Snapshot ' + backupId + ' already exists; skipping.');
      return;
    } else {
      console.log('Copying automated snapshot id ' + id + ` to manual snapshot id ` + backupId);
    }

    const params = {
      SourceDBSnapshotIdentifier: id,
      TargetDBSnapshotIdentifier: backupId
    };
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
            const backupTag = data.TagList.filter (({Key: k, Value: v}) => k === 'cj:backup' && v === 'true');
            if (backupTag.length === 0) {
              console.log('This instance is not tagged with "cj:backup": "true"; skipping id: ' + dbId);
              return;
            } else console.log('Instance tagged with "cj:backup": "true" found; proceeding with id: ' + dbId);
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
