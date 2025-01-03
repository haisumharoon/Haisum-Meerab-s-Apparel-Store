const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require("multer");
const path = require('path');
const mysql = require('mysql'); 
const createTables = require("./tables")
const jwt = require("jsonwebtoken")
const fs = require('fs');
const {Server } = require("socket.io")
require("dotenv").config()

const io = new Server({
    cors:true
})
const nameSocketMapping = new Map()
const socketNameMapping = new Map()
io.on("connection",(socket)=>{
    console.log("connected"); 
    socket.on("join-room",(data)=>{
        socket.join("room"); 
        const decoded = jwt.verify(data.token,process.env.ACCESSTOKEN);
        console.log("joined room: "+decoded.id);
        con.query(`SELECT * FROM user WHERE user_id = "${decoded.id}";`, function (err, result) {
        if(err){
            return res.status(500).json({message:""+err})
        }
        socket.broadcast.to("room").emit("message", { message: `${result[0].name} joined the room`,user_name:result[0].name });
        nameSocketMapping.set(result[0].name,socket.id)
        socketNameMapping.set(socket.id,result[0].name)
        socket.emit("joined", { message: `Welcome ${result[0].name}`,user_name:result[0].name });
    }
    ) 
    }
    )
    socket.on("offer",(data)=>{
        const {offer,name} = data
        const socketId = nameSocketMapping.get(name)
        socket.to(socketId).emit("incoming_call", { offer: offer,name:name});
    }
    )
    socket.on("call-accepted",(data)=>{
        const {answer,name} = data
        const socketId = nameSocketMapping.get(name)
        socket.to(socketId).emit("incoming-call", { answer: answer });
    } 
    )
})
io.listen(5001)
const app = express();
const PORT = process.env.PORT || 5000;

const storage = multer.diskStorage({
    destination: (req,file,cb)=>{
        return cb(null,"./uploads")
    },
    filename:(req,file,cb)=>{
        return cb(null,`${Date.now()}-${file.originalname}`)
    }
});
const upload = multer({storage:storage})
app.use(cors());
app.use(bodyParser.json());

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
var con = mysql.createConnection({
  host: process.env.MYSQLHOST,
  user: process.env.MYSQLUSER,
  password: process.env.MYSQLPASSWORD
});

con.connect(function(err) {
    if (err) throw err; 
  console.log("Connected!");
  createTables(con);
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}
});
app.get('/uploads/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, 'uploads', filename);

    res.sendFile(filePath, (err) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.status(404).json({ message: 'Image not found' });
            } else {
                console.error('Error sending file:', err);
                res.status(500).json({ message: 'Internal Server Error' });
            }
        }
    });
});
app.post("/listing",upload.single("file"),(req,res)=>{
    const {title,stock,price,sub_categories: subCategoriesString} = req.body 
    const file = req.file 
    const sub_categories = subCategoriesString.split(",").map((subCategory)=>parseInt(subCategory))
    console.log(req);
    con.query(`INSERT INTO listing (title,stock,price,image_path) VALUES ("${title}",'${stock}',"${price}","${file.filename}");`, function (err, result) {
        if(err){
            if (file) {
                const filePath = path.join(__dirname, 'uploads/', file.filename);
                fs.unlink(filePath, (err) => {
                    if (err) {
                        console.error('Error deleting file:', err);
                    }
                    console.log("deleted successfully");
                });
            }
            return res.status(500).json({message:""+err})
            
        }
        console.log(sub_categories);
        try{
        sub_categories.forEach((subCategory,index)=>{
            con.query(`INSERT INTO listing_categories (listing_id,sub_category_id) VALUES ("${result.insertId}","${subCategory}");`, function (err, result) {
                if(err){
                    return res.status(500).json({message:""+err})
                }
                if(index == sub_categories.length-1){
                    return res.status(200).json({message:"Listing created successfully"})
                }
            });
        })}catch(e){
             if (file) {
                const filePath = path.join(__dirname, 'uploads/', file.filename);
                fs.unlink(filePath, (err) => {
                    if (err) {
                        console.error('Error deleting file:', err);
                    }
                    console.log("deleted successfully");
                });
            }
            con.query(`DELETE FROM listing WHERE listing_id = "${result.insertId}";`, function (err, result) {});   
            return res.status(500).json({message:""+e
        })
        }
        if(sub_categories.length == 0 && index == sub_categories.length-1){
            return res.status(200).json({message:"Listing created successfully"})
        } 
    });
})
app.put("/listing/:id",upload.single("file"),(req,res)=>{
    console.log(req.body);
    const {title,stock,price,sub_categories: subCategoriesString} = req.body;
    const file = req.file; 
    const sub_categories = subCategoriesString.split(",").map((subCategory)=>parseInt(subCategory))

    con.query(`UPDATE listing SET title = "${title}", stock = "${stock}", price = "${price}"  WHERE listing_id = ${req.params.id};`, function (err, result) {
        if(err){
            return res.status(500).json({message:""+err})
        }
        con.query(`DELETE FROM listing_categories WHERE listing_id = ${req.params.id};`, function (err, result) {
            if(err){
                return res.status(500).json({message:""+err})
            }
            if(sub_categories.length == 0){
                return res.status(200).json({message:"Listing updated successfully"})
            }
            sub_categories.forEach((subCategory,index)=>{
            con.query(`INSERT INTO listing_categories (listing_id,sub_category_id) VALUES ("${req.params.id}","${subCategory}");`, function (err, result) {
                if(err){
                    return res.status(500).json({message:""+err})
                }
                
                if(index == sub_categories.length-1 ){
                    return res.status(200).json({message:"Listing updated successfully"})
                }
            }
            );
        })
        }
        )
      });
}
)
app.delete("/listing/:id",(req,res)=>{
    con.query(`SELECT * FROM listing WHERE listing_id = ${req.params.id};`, function (err, result) {
    if (result.length > 0 && result[0].image_path) {
                const filePath = path.join(__dirname, 'uploads/', result[0].image_path);
                fs.unlink(filePath, (err) => {
                    if (err) {
                        console.error('Error deleting file:', err);
                    }
                });
            }
        con.query(`DELETE FROM listing WHERE listing_id = ${req.params.id};`, function (err, resu) {
        if(err){
            return res.status(500).json({message:""+err})
        } 
        
        return res.status(200).json({message:"Listing deleted successfully"})
    });})
}
)
app.get("/admin/listing",(req,res)=>{
    con.query(`SELECT * FROM listing;`, function (err, result) {
        if(err){
            return res.status(500).json({message:""+err})
        }
        if(result.length == 0){
            return res.status(200).json([])
        }
        result.forEach((listing,index)=>{
            con.query(`select c.sub_category_id from listing_categories lc inner join sub_categories c on lc.sub_category_id = c.sub_category_id where lc.listing_id = ${listing.listing_id};`, function (err, categories) {
                if(err){
                    return res.status(500).json({message:""+err})
                }
                listing.sub_categories = categories.map((category)=>category.sub_category_id) 
                if(index == result.length-1){
                    return res.status(200).json(result)
                }
            });
        })
    });
}
)
app.get("/listing",(req,res)=>{
    con.query(`SELECT * FROM listing;`, function (err, result) {
        if(err){
            return res.status(500).json({message:""+err})
        }
        if(result.length == 0){
            return res.status(200).json([])
        }
        result.forEach((listing,index)=>{
            con.query(`select c.sub_category_id,c.name from listing_categories lc inner join sub_categories c on lc.sub_category_id = c.sub_category_id where lc.listing_id = ${listing.listing_id};`, function (err, categories) {
                if(err){
                    return res.status(500).json({message:""+err})
                }
                listing.sub_categories = categories
                if(index == result.length-1){
                    return res.status(200).json(result)
                }
            });
        })
    });
}
)
app.get("/user",authorize_token,(req,res)=>{ 
    con.query(`SELECT * FROM user WHERE user_id = "${req.user.id}";`, function (err, result) {
        if(err){
            return res.status(500).json({message:""+err})
        }
        return res.status(200).json({user:result[0]})
    });
})
app.get("/all_categories",(req,res)=>{
    const start = new Date().getTime()
    con.query(`SELECT * FROM customer_category;`, (err, result)=> {
        if(err){
            return res.status(500).json({message:""+err})
        }
        if(result.length == 0){
            return res.status(200).json([])
        }
          result.forEach((category,index)=>{
             con.query(`SELECT * FROM categories WHERE cc_id = ${category.cc_id};`,   function (err, subCategories) {
                if(err){
                    return res.status(500).json({message:""+err})
                }  
                // if(subCategories.length == 0){
                //     if(index == result.length-1){
                //         return res.status(200).json(result)
                //     }
                // }
                 subCategories.forEach((subCategory,i)=>{
                    con.query(`SELECT * FROM sub_categories WHERE category_id = ${subCategory.category_id};`, function (err, subSubCategories) {
                        if(err){
                            return res.status(500).json({message:""+err})
                        }
                        subCategory.sub_categories = subSubCategories
                        
                        console.log(result[0].sub_categories); 
                        if(i == subCategories.length-1 && index == result.length-1){
                           return res.status(200).json(result)
                        }
                    })
                }) 
                
                category.sub_categories = subCategories 
                setTimeout(()=>{
                if(index == result.length-1 && subCategories.length == 0){
                    return res.status(200).json(result)
                }},200)
            });
            
        })  
    });
})
app.post("/wishlist/:id",authorize_token,(req,res)=>{
    const {amount} = req.body
    con.query(`INSERT INTO wishlist (user_id,listing_id,amount) VALUES ("${req.user.id}","${req.params.id}","${amount}");`, function (err, result) {
        if(err){
            return res.status(500).json({message:""+err})
        } 
        return res.status(200).json({message:"Added to wishlist"})
    });
}
)
app.get("/wishlist",authorize_token,(req,res)=>{
    con.query(`SELECT * FROM listing where listing_id in (SELECT listing_id FROM wishlist WHERE user_id = "${req.user.id}");`, function (err, result) {
        if(err){
            return res.status(500).json({message:""+err})
        }
        return res.status(200).json(result)
    });
}
)
app.get("/listing/category/:id",(req,res)=>{
    con.query(`select * from listing where listing_id in (select listing_id from listing_categories where sub_category_id=${req.params.id});`, function (err, result) {
        if(err){
            return res.status(500).json({message:""+err})
        }
        return res.status(200).json(result)
    });
})
app.get("/listing/search/:query",(req,res)=>{
    const selectedCategory = req.query.selected_category;
    var query = `SELECT * FROM listing WHERE title LIKE '%${req.params.query}%'`;
    if(selectedCategory){
        query = `SELECT * FROM listing WHERE title LIKE '%${req.params.query}%' AND listing_id in (SELECT listing_id FROM listing_categories WHERE sub_category_id = ${selectedCategory})`
    }
    con.query(query, function (err, result) {
        
        if(err){
            return res.status(500).json({message:""+err})
        }
        return res.status(200).json(result)
    });
})
app.get("/listing/:id",authorize_token,(req,res)=>{
    con.query(`SELECT * FROM listing WHERE listing_id = ${req.params.id};`, function (err, result) {
        if(err){
            return res.status(500).json({message:""+err})
        }
        if(result.length == 0){
            return res.status(200).json([])
        }
        con.query(`select * from listing_categories lc inner join sub_categories c on lc.sub_category_id = c.sub_category_id where lc.listing_id = ${result[0].listing_id};`, function (err, categories) {
            if(err){
                return res.status(500).json({message:""+err})
            }
            result[0].categories = categories
            con.query(`select * from wishlist where user_id = ${req.user.id} and listing_id = ${req.params.id};`, function (err, wish) {
                if(err){
                    return res.status(500).json({message:""+err})
                }
                result[0].wish = wish.length > 0
                return res.status(200).json(result[0])
            }
            );
        });
    });
})
app.delete("/wishlist/:id",authorize_token,(req,res)=>{

    con.query(`DELETE FROM wishlist WHERE user_id = "${req.user.id}" AND listing_id = "${req.params.id}";`, function (err, result) {
        if(err){
            return res.status(500).json({message:""+err})
        }
        return res.status(200).json({message:"Removed from wishlist"})
    });
}
)
app.post("/customer-categories",authorize_token,(req,res)=>{
     
    const {name} = req.body 
    con.query(`INSERT INTO customer_category (name) VALUES ("${name}");`, function (err, result) {
        if(err){
            return res.status(500).json({message:""+err})
        }
        return res.status(200).json({message:"Category created successfully"})
    });
})

app.get("/users",authorize_token,(req,res)=>{
    con.query(`select * from user u inner join credentials c on c.credential_id = u.credential_id;`, function (err, result) {
        if(err){
            return res.status(200).json(result);
        }
        
        return res.status(200).json(result)
    });
})
app.post("/order/:id",authorize_token,(req,res)=>{
    const {amount,longitude,latitude,location} = req.body 
    con.query(`INSERT INTO orders (user_id,listing_id,amount,longitude,latitude,location) VALUES ("${req.user.id}","${req.params.id}","${amount}","${longitude}","${latitude}","${location}");`, function (err, result) {
        if(err){
            return res.status(500).json({message:""+err})
        }
        con.query(`UPDATE listing SET stock = stock - ${amount} WHERE listing_id = ${req.params.id};`, function (err, result) {
        if(err){
            return res.status(500).json({message:""+err})
        }
        console.log("1 record inserted");
        return res.status(200).json({message:"Order created successfully"})
    })
    });
})
app.post("/users",authorize_token,(req,res)=>{
    const {name,username,email,password,isAdmin} = req.body 
    con.query(`INSERT INTO credentials (username,email,password) VALUES ("${username}","${email}","${password}");`, function (err, result) {
        if(err){
            return res.status(500).json({message:""+err})
        }
        con.query(`INSERT INTO user (name,credential_id,isAdmin) VALUES ("${name}","${result.insertId}","${isAdmin}");`, function (err, userResult) {
        if(err){
            con.query(`DELETE FROM credentials WHERE credential_id = "${result.insertId}";`, function (err, result) {});
            return res.status(500).json({message:""+err})
        }
        console.log("1 record inserted");
        return res.status(200).json({message:"User created successfully"})
    });
    });
})
app.get("/user/:id",authorize_token,(req,res)=>{
    con.query(`SELECT * FROM user WHERE user_id = "${req.params.id}";`, function (err, result) {
        if(err){
            return res.status(500).json({message:""+err})
        }
        return res.status(200).json(result)
    });
}
)
app.put("/users/:id",authorize_token,(req,res)=>{
    const {name,username,email,password,isAdmin} = req.body 
    con.query(`UPDATE user SET name = "${name}", isAdmin = "${isAdmin}" WHERE credential_id = "${req.params.id}";`, function (err, result) {
        if(err){
            return res.status(500).json({message:""+err})
        }
        con.query(`UPDATE credentials SET username = "${username}", email = "${email}", password = "${password}" WHERE credential_id = "${req.params.id}";`, function (err, userResult) {
        if(err){
            return res.status(500).json({message:""+err})
        }
        console.log("1 record inserted");
        return res.status(200).json({message:"User updated successfully"})
    });
    });
})
app.delete("/users/:id",authorize_token,(req,res)=>{
    console.log(req.params.id);
    
        con.query(`DELETE FROM credentials WHERE credential_id = "${req.params.id}";`, function (err, result) {
        if(err){
            return res.status(500).json({message:""+err})
        }
        return res.status(200).json({message:"User deleted successfully"})
    }); 
}
)
app.put("/customer-categories/:id",authorize_token,(req,res)=>{
    const {name} = req.body 
    con.query(`UPDATE customer_category SET name = "${name}" WHERE cc_id = ${req.params.id};`, function (err, result) {
        if(err){
            return res.status(500).json({message:""+err})
        }
        return res.status(200).json({message:"Category updated successfully"})
    });
})
app.delete("/customer-categories/:id",authorize_token,(req,res)=>{
    con.query(`DELETE FROM customer_category WHERE cc_id = ${req.params.id};`, function (err, result) {
        if(err){
            return res.status(500).json({message:""+err})
        }
        return res.status(200).json({message:"Category deleted successfully"})
    });
})
app.get("/customer-categories",(req,res)=>{
    con.query(`SELECT * FROM customer_category;`, function (err, result) {
        if(err){
            return res.status(500).json({message:""+err})
        }
        return res.status(200).json(result)
    });
})
app.get("/categories",(req,res)=>{
    con.query(`SELECT * FROM categories;`, function (err, result) {
        if(err){
            return res.status(500).json({message:""+err})
        }
        return res.status(200).json(result)
    });
})
app.get("/sub-categories",(req,res)=>{
    con.query(`SELECT * FROM sub_categories;`, function (err, result) {
        if(err){
            return res.status(500).json({message:""+err})
        }
        return res.status(200).json(result)
    });
})
app.post("/categories",authorize_token,(req,res)=>{
    const {cc_id,name} = req.body 
    console.log(cc_id,name)
    con.query(`SELECT * FROM customer_category WHERE cc_id = "${cc_id}";`, function (err, ccResult) {
        if(err){
            return res.status(500).json({message:""+err})
        }
        con.query(`INSERT INTO categories (cc_id,name,parent_description) VALUES ("${cc_id}","${name}","${ccResult[0].name}");`, function (err, result) {
        if(err){
            return res.status(500).json({message:""+err})
        }
        return res.status(200).json({message:"Category created successfully"})
    });
    })
    
})
app.put("/categories/:id",authorize_token,(req,res)=>{
    const {name,cc_id} = req.body 
    con.query(`SELECT * FROM customer_category WHERE cc_id = "${cc_id}";`, function (err, ccResult) {
        if(err){
            return res.status(500).json({message:""+err})
        }
    con.query(`UPDATE categories SET name = "${name}", cc_id = "${cc_id}", parent_description = "${ccResult[0].name}" WHERE category_id = ${req.params.id};`, function (err, result) {
        if(err){
            return res.status(500).json({message:""+err})
        }
        return res.status(200).json({message:"Category updated successfully"})
    });
});
});
app.delete("/categories/:id",authorize_token,(req,res)=>{
    con.query(`DELETE FROM categories WHERE category_id = ${req.params.id};`, function (err, result) {
        if(err){
            return res.status(500).json({message:""+err})
        }
        return res.status(200).json({message:"Category deleted successfully"})
    });
})
app.post("/sub-categories",authorize_token,(req,res)=>{
    const {category_id,name} = req.body 
    console.log(category_id,name)
    con.query(`SELECT * FROM categories WHERE category_id = "${category_id}";`, function (err, cResult) {
        if(err){
            return res.status(500).json({message:""+err})
        }
    con.query(`INSERT INTO sub_categories (category_id,name,parent_description) VALUES ("${category_id}","${name}","${cResult[0].name} ${cResult[0].parent_description}");`, function (err, result) {
        if(err){
            return res.status(500).json({message:""+err})
        }
        return res.status(200).json({message:"Category created successfully"})
    });});
}
)
app.put("/sub-categories/:id",authorize_token,(req,res)=>{
    const {name,category_id} = req.body 
    con.query(`SELECT * FROM categories WHERE category_id = "${category_id}";`, function (err, cResult) {
        if(err){
            return res.status(500).json({message:""+err})
        }
    con.query(`UPDATE sub_categories SET name = "${name}", category_id = "${category_id}", parent_description="${cResult[0].name} ${cResult[0].parent_description}" WHERE sub_category_id = ${req.params.id};`, function (err, result) {
        if(err){
            return res.status(500).json({message:""+err})
        }
        return res.status(200).json({message:"Category updated successfully"})
    });
});
}
)
app.delete("/sub-categories/:id",authorize_token,(req,res)=>{
    con.query(`DELETE FROM sub_categories WHERE sub_category_id = ${req.params.id};`, function (err, result) {
        if(err){
            return res.status(500).json({message:""+err})
        }
        return res.status(200).json({message:"Category deleted successfully"})
    });
}
)

app.post("/register",(req,res)=>{
    const {name,username,email,password} = req.body 
    con.query(`INSERT INTO credentials (username,email,password) VALUES ("${username}","${email}","${password}");`, function (err, result) {
         
        if(err){
            return res.status(500).json({message:""+err})
        }
        con.query(`INSERT INTO user (name,credential_id) VALUES ("${name}","${result.insertId}");`, function (err, userResult) {
        if(err){
            return res.status(500).json({message:""+err})
        }
        console.log("1 record inserted");
        return res.status(200).json({message:"User registered successfully"})
    });
    });
})

app.post("/login", (req,res)=>{
    const {email,password} = req.body 
    con.query(`SELECT * FROM credentials WHERE email = "${email}" AND password = "${password}";`, function (err, result) {
        if(err){
            return res.status(500).json({message:""+err})
        }
        if(result.length == 0){
            return res.status(401).json({message:"Invalid credentials"})
        }
        con.query(`SELECT * FROM user WHERE credential_id = ${result[0].credential_id};`, function (err, userResult) {
        if(err){
            return res.status(500).json({message:""+err})
        }
        
        const token =  jwt.sign({ sub: 'userId' , id: userResult[0].user_id},process.env.ACCESSTOKEN)
        console.log(token);
        return res.status(200).json({message:"User logged in successfully",token:token})
    }
    );
    });
});
app.get("/all_orders",authorize_token,(req,res)=>{
    con.query(`SELECT * FROM orders;`, function (err, result) {
        if(err){
            return res.status(500).json({message:""+err})
        }
        return res.status(200).json(result)
    });
}) 
app.get("/order/:id",authorize_token,(req,res)=>{
    con.query(`SELECT * FROM orders WHERE order_id = ${req.params.id};`, function (err, result) {
        if(err){
            return res.status(500).json({message:""+err})
        }
        return res.status(200).json(result[0])
    });
}
)
app.delete("/order/:id",authorize_token,(req,res)=>{
    con.query(`DELETE FROM orders WHERE order_id = ${req.params.id};`, function (err, result) {
        if(err){
            return res.status(500).json({message:""+err})
        }
        return res.status(200).json({message:"Order deleted successfully"})
    });
})
app.get("/orders",authorize_token,(req,res)=>{
    con.query(`SELECT * FROM orders WHERE user_id = ${req.user.id};`, function (err, result) {
        if(err){
            return res.status(500).json({message:""+err})
        }
        return res.status(200).json(result)
    });
})

function authorize_token(req,res,next){
    const auth_tkn = req.headers["authorization"]
    console.log(auth_tkn);
    const token = auth_tkn?.split(" ")[1];
    if(token == null){
        return res.status(401).json({message:"Bad request, no auth"})
    }
    var decoded;
    try{
    decoded = jwt.verify(token,process.env.ACCESSTOKEN);
}catch(e){
    
            return res.status(401).send('unauthorized');
}
    req.user = decoded 
    next()
}