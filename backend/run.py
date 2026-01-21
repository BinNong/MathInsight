from app import create_app
import os

app = create_app()

if __name__ == '__main__':
    # 生产环境应设置为 false，development 模式应仅在开发时开启
    debug = os.environ.get('FLASK_DEBUG', 'false').lower() in ('true', '1', 'yes')
    app.run(debug=debug, host='0.0.0.0', port=5000)
