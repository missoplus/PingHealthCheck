const axios = require("axios");
const ping = require('ping');
const fs = require('fs');


const url = "http://185.216.140.233/api/debug/healthCheck";

async function doTest() {
    let duplicates = 0 ;
    let response = await axios.get(url);
    let checked = [];
    let data = {failedIps : [] , successIps:[]};
    try {
        data = fs.readFileSync('data.json');
        data = JSON.parse(data);
    }catch (e){
        console.log("restore point file doesn't exists");
    }
    const platforms = Object.keys(response.data.Services);
    for (platform of platforms) {
        for (service of Object.keys(response.data.Services[platform])) {
            for (server of response.data.Services[platform][service]) {
                const address = server.Address.split(":")[0];
                const port = server.Address.split(":")[1] ? server.Address.split(":")[1] : server.Port; 
                if (!checked.includes(address)) {
                    checked.push(address);
                }else{
                    duplicates++;
                }        
            }
        }
    }
    console.log(`${duplicates} duplicates exists`);

    let str = `
        <html>
            <head>
                <title>Health Check</title>
                <link rel="stylesheet" type="text/css" href="http://cdn.datatables.net/1.12.1/css/jquery.dataTables.min.css">
            </head>
        <body>
        %PLACEHOLDER%
        <table id="table" class="display" style="width:100%">
        <thead>
            <tr>
                <th>IP</th>
                <th>Status</th>
                <th>Average</th>
                <th>Packet Loss</th>
            </tr>
        </thead>
        <tbody> `;

    let promises = [] ;
    for (let i = 0 ; i < checked.length ; i++){ 
        promises.push(ping.promise.probe(checked[i],{
            min_reply: 10,
            timeout : 0.8
        }));       
    }
    const results = await Promise.all(promises);
    let newFailedIps = [];
    let newSuccessIps = [];
    results.forEach((isAlive,i)=>{
        const ip = checked[i];
        const msg = isAlive.alive ? 'host ' + checked[i] + ' is alive' : 'host ' + checked[i] + ' is dead';
        str += `<tr>
                    <th>${ip}</th>
                    <th ${isAlive.alive ? 'style="background-color:green;"' : 'style="background-color:red;"'}>${isAlive.alive ? 'OK' : 'FAIL'}</th>
                    <th>${isAlive.avg}</th>
                    <th>${isAlive.packetLoss}</th>
                </tr>`;
        console.log(msg);
        if (isAlive.alive){
            if(data.failedIps.includes(ip)){
                //remove ip from failed list
                data.failedIps.splice(data.failedIps.indexOf(ip),1);
                data.successIps.push(ip);
                newSuccessIps.push(ip);
            }
            if(!data.successIps.includes(ip)){
                //add ip to success list
                data.successIps.push(ip);
            }
        }else{
            if(data.successIps.includes(ip)){
                //remove ip from success list
                data.successIps.splice(data.successIps.indexOf(ip),1);
                data.failedIps.push(ip);
                newFailedIps.push(ip);

            }
            if(!data.failedIps.includes(ip)){
                //add ip to failed list
                data.failedIps.push(ip);
            }
        }
    });
    str += "</tbody></table>";
    //add datatable to html
    str += `
    <script src="http://code.jquery.com/jquery-3.5.1.js"></script>
    <script src="http://cdn.datatables.net/1.10.22/js/jquery.dataTables.min.js"></script>
    <script>
        $(document).ready(function() {
            $('#table').DataTable({
        lengthMenu: [
            [1000, 25, 50, -1],
            [1000, 25, 50, 'All'],
        ],
    });
        });
    </script>
    </body>
    </html>
    `;

    let successFailsMsg = "Recovered Ips : <br><span style='color:green'>" + newSuccessIps.join("<br>") + "</span><br>Failed Ips : <br><span style='color: red'>" + newFailedIps.join("<br>") + "</span>";
    str = str.replace("%PLACEHOLDER%",successFailsMsg);
    //safe current date-time filename
    const date = new Date();
    const fileName = date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + date.getDate() + "-" + date.getHours() + "-" + date.getMinutes() + "-" + date.getSeconds() ;
    fs.writeFileSync(`report-${fileName}.htm`, str);
    fs.writeFileSync('data.json', JSON.stringify(data));
}
doTest();