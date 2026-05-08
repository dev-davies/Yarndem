content = open('app/components/MessageWindow.vue', 'r').read()  
content = content.replace('isContactTyping,', 'isContactTyping,' newline isConnected,')  
open('app/components/MessageWindow.vue', 'w').write(content)  
