const AWS = require('aws-sdk');
const awsLib = require('./lib/AwsLib');
const argv = require('yargs')
   .alias('g', 'group')
   .alias('s', 'stream')
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
if ('stream' in argv) {
   let streams = argv.stream;
   if (!Array.isArray(streams)) {
      streams = [streams];
   }
   logStreamsPromise = Promise.resolve(streams);
}
else if ('streamCount' in argv) {
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

function tailLogStreams(startTime, logStreams) {
   //console.log(startTime);

   const logEventPromises = logStreams
      .map(streamName => {
         return cloudWatchLogs.getLogEvents({
               logGroupName: logGroupName,
               logStreamName: streamName,
               startFromHead: true,
               startTime: startTime
            });
      })

   return Promise.all(logEventPromises)
      .then(logEventResults => {
         const logEvents = logEventResults
            .map(result => result.events)
            .reduce((left, right) => left.concat(right))
            .sort((left, right) => left.timestamp - right.timestamp);

         logEvents
            .forEach(logEvent => {
               console.log(logEvent.message);
            })

         let nextPromise;
         if (logEvents.length > 0) {
            // TODO this could miss logs depending on how AWS deals with them
            nextPromise = () => tailLogStreams(logEvents[logEvents.length - 1].timestamp + 1, logStreams);
         }
         else {
            // if we didn't find anything keep watching the same time
            nextPromise = () => tailLogStreams(startTime, logStreams);
         }

         return delay(refreshDelay)
            .then(nextPromise);
      });
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