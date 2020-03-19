const AWS = require('aws-sdk');
const awsLib = require('./lib/AwsLib');
const argv = require('yargs')
   .alias('g', 'group')
   .alias('r', 'region')
   .alias('c', 'streamCount')
   .default('refresh', 1000)
   .demandOption(['group', 'region'])
   .argv;

function delay(t) {
   return new Promise(function(resolve) {
      setTimeout(resolve, t);
   });
}

AWS.config.update({region: argv.region});

const cloudWatchLogs = new awsLib.AwsPromise(new AWS.CloudWatchLogs());

const logGroupName = argv.group;
const refreshDelay = argv.refresh;

// get the passed in log stream or resolve them off of the group
let logStreamsPromise;
if ('streamCount' in argv) {
   // TODO this doesn't work for high counts
   logStreamsPromise = cloudWatchLogs.describeLogStreams({
         logGroupName: logGroupName,
         limit: argv.streamCount,
         descending: true,
         orderBy: 'LastEventTime'
      })
      .then((result) => {
         return result.logStreams.map(logStream => logStream.logStreamName);
      })
}
else {
   console.error('Missing stream or stream count')
   process.exit(1);
}

// kick off tailing our results
logStreamsPromise
   .then(logStreams => {
      console.log("Tailing Log Streams:")
      logStreams.forEach(logStream => console.log(logStream));
      console.log();

      tailLogStreams(Date.now() - 30 * 1000, logStreams);
   })
   .catch(error => {
      console.log(error);
   });