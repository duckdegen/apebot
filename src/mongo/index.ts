import { connect, connection } from "mongoose";

export default (connectionString: string): void => {
    const performConnection = (mongoconnectionstring) => {
        connect(mongoconnectionstring, { useNewUrlParser: true })
            .then(() => {
                return console.info(`Successfully connected to Mongo`);
            })
            .catch((error) => {
                console.error("Error connecting to database: ", error);
                return process.exit(1);
            });
    };
    performConnection(connectionString);

    connection.on("disconnected", performConnection);
};
