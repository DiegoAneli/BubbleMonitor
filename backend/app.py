from flask import Flask, jsonify
from flask_cors import CORS
import psutil

app = Flask(__name__)
CORS(app) 

@app.route('/connections', methods=['GET'])
def get_connections():
    connections = []
    ports_to_monitor = {80, 443, 22, 3306, 5432}  # Set di porte da monitorare
    for conn in psutil.net_connections(kind='inet'):
        if conn.laddr.port in ports_to_monitor or (conn.raddr and conn.raddr.port in ports_to_monitor):
            connection_info = {
                'local_address': conn.laddr.ip,
                'local_port': conn.laddr.port,
                'remote_address': conn.raddr.ip if conn.raddr else None,
                'remote_port': conn.raddr.port if conn.raddr else None,
                'status': conn.status
            }
            connections.append(connection_info)
    return jsonify(connections)

if __name__ == '__main__':
    app.run(debug=True)
