/**
 * SdtdServerController
 *
 * @description :: Server-side logic for managing sdtdservers
 * @help        :: See http://sailsjs.org/#!/documentation/concepts/Controllers
 */

module.exports = {
    addServer: async function(req, res) {
        const IP = req.param("IP")
        const telnetPort = parseInt(req.param("TelnetPort"))
        const telnetPassword = req.param("TelnetPassword")

        try {
            let connection = await sails.helpers.connectToTelnet({
                ip: IP,
                port: telnetPort,
                password: telnetPassword
            })
            const authInfo = await sails.helpers.createWebToken({
                telnetConnection: connection
            })

            sails.models.sdtdserver.create({
                    ip: IP,
                    telnetPort: telnetPort,
                    telnetPassword: telnetPassword,
                    webPort: telnetPort + 1,
                    authName: authInfo.authName,
                    authToken: authInfo.authToken,
                    owner: req.session.userId
                }).meta({ fetch: true })
                .exec(function(err, sdtdServer) {
                    sails.log(err)
                    return res.redirect(`/sdtdserver/dashboard?id=${sdtdServer.id}`)
                })



        } catch (error) {
            console.log(error)
        }
    },

    dashboard: async function(req, res) {

        const serverID = req.query.id

        let day7data
        let onlinePlayers

        await sails.helpers.getStats({
            id: serverID,
        }).switch({
            success: function(data) {
                day7data = data;
            },
            error: function(err) {
                return res.badRequest("Invalid permissions for 7 days server. Please check your webtokens or add your server again.")
            }
        });

        await sails.helpers.getPlayersOnline({
            id: serverID
        }).switch({
            success: function(data) {
                onlinePlayers = data
                res.view('dashboard.ejs', {
                    title: "Server Dashboard",
                    day7data,
                    onlinePlayers
                })
            },
            error: function(err) {
                return res.badRequest("Invalid permissions for 7 days server. Please check your webtokens or add your server again.")
            }
        })


    },

    console: async function(req, res) {
        const serverID = req.query.id
        let telnetSocket = await sails.helpers.createTelnetSocket({ id: serverID })

        return res.view("console", {
            telnetSocket: telnetSocket
        })
    },

    startLogging: async function(req, res) {
        console.log("Start logging")
        const serverID = req.query.id
        if (!serverID) { throw new Error("Must provide a server ID in query") }
        const server = await sails.models.sdtdserver.findOne(serverID)
        await sails.models.sdtdserver.update({ id: serverID }, { loggingEnabled: true })
        let telnetSocket = await sails.helpers.createTelnetSocket({ id: serverID })
        sails.models.sdtdserver.telnetSocket.on('data', async function createLogLine(dataLine) {
            await LogLine.create({
                logType: "telnet",
                message: dataLine.toString(),
                serverID: serverID
            }).exec(function() {

            })
        })
        return res.send(200)
    },

    stopLogging: async function(req, res) {
        console.log("Stop logging")
        const serverID = req.query.id
        if (!serverID) { throw new Error("Must provide a server ID in query") }
        await sails.models.sdtdserver.update({ id: serverID }, { loggingEnabled: false })
        sails.models.sdtdserver.telnetSocket.removeAllListeners('data')
    }

};