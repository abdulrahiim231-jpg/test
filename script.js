// Baby Store JavaScript

// Supabase configuration
const SUPABASE_URL = 'https://dylgzqfgcfsrjfejjhjy.supabase.co/rest/v1/';
const SUPABASE_ANON_KEY = 'sb_publishable_bHly-c0wyjZeKsj8pghYbw_TVhG5pyx';

// Cart functionality
let cart = [];
let cartCount = 0;

// Cart modal functions
function openCart() {
    const modal = document.getElementById('cartModal');
    modal.classList.remove('hidden');
    renderCartItems();
}

function closeCart() {
    const modal = document.getElementById('cartModal');
    modal.classList.add('hidden');
}

function renderCartItems() {
    const cartItemsContainer = document.getElementById('cartItems');
    const cartTotalElement = document.getElementById('cartTotal');
    
    if (cart.length === 0) {
        cartItemsContainer.innerHTML = '<p class="text-gray-500 text-center py-8">Your cart is empty</p>';
        cartTotalElement.textContent = '0.00';
        return;
    }
    
    let total = 0;
    let cartHTML = '';
    
    cart.forEach((item, index) => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;
        
        cartHTML += `
            <div class="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div class="flex-1">
                    <h3 class="font-semibold text-gray-900">${item.name}</h3>
                    <p class="text-gray-600">Price: ${item.price.toFixed(2)}</p>
                    <div class="flex items-center space-x-2 mt-2">
                        <button onclick="updateQuantity(${index}, -1)" class="w-8 h-8 bg-gray-200 rounded-full hover:bg-gray-300">-</button>
                        <span class="font-medium">${item.quantity}</span>
                        <button onclick="updateQuantity(${index}, 1)" class="w-8 h-8 bg-gray-200 rounded-full hover:bg-gray-300">+</button>
                    </div>
                </div>
                <div class="text-right">
                    <p class="font-bold text-lg">${itemTotal.toFixed(2)}</p>
                    <button onclick="removeFromCart(${index})" class="text-red-500 hover:text-red-700 text-sm">
                        Remove
                    </button>
                </div>
            </div>
        `;
    });
    
    cartItemsContainer.innerHTML = cartHTML;
    cartTotalElement.textContent = total.toFixed(2);
}

function updateQuantity(index, change) {
    cart[index].quantity += change;
    
    if (cart[index].quantity <= 0) {
        removeFromCart(index);
    } else {
        renderCartItems();
        updateCartCount();
    }
}

function removeFromCart(index) {
    cart.splice(index, 1);
    renderCartItems();
    updateCartCount();
    showNotification('Item removed from cart', 'success');
}

function clearCart() {
    cart = [];
    renderCartItems();
    updateCartCount();
    showNotification('Order cancelled', 'success');
}

// Initialize Supabase client
const { createClient } = window.supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Update stock in Supabase (optimized)
async function updateStock(productId, newStock) {
    try {
        const startTime = performance.now();
        
        const response = await fetch(`${SUPABASE_URL}product?id=eq.${productId}`, {
            method: 'PATCH',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify({ stock: newStock })
        });
        
        const endTime = performance.now();
        console.log(`Stock update took ${endTime - startTime}ms`);
        
        if (!response.ok) {
            console.error('Failed to update stock:', response.status, response.statusText);
            return false;
        }
        
        console.log('Stock updated successfully to:', newStock);
        return true;
    } catch (error) {
        console.error('Error updating stock:', error);
        return false;
    }
}

// Complete order system
async function completeOrder() {
    try {
        if (cart.length === 0) {
            showNotification('Your cart is empty', 'error');
            return;
        }
        
        // Step A: Prepare order message
        const orderMessage = prepareOrderMessage();
        
        // Step B: Update stock in Supabase
        const stockUpdateSuccess = await updateStockForCartItems();
        
        if (stockUpdateSuccess) {
            // Step C: WhatsApp redirect with order message
            sendOrderToWhatsApp(orderMessage);
            
            // Step D: Empty cart
            cart = [];
            updateCartCount();
            closeCart();
            
            showNotification('Order completed successfully!', 'success');
            
            // Refresh products to show updated stock
            setTimeout(() => {
                renderProducts();
            }, 1000);
        } else {
            showNotification('Failed to update stock. Please try again.', 'error');
        }
        
    } catch (error) {
        console.error('Order completion error:', error);
        showNotification('Order failed. Please try again.', 'error');
    }
}

// Prepare formatted order message
function prepareOrderMessage() {
    const orderItems = cart.map(item => 
        `${item.name}: $${item.price.toFixed(2)} x ${item.quantity} = $${(item.price * item.quantity).toFixed(2)}`
    ).join('\n');
    
    const totalAmount = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0).toFixed(2);
    
    return `🛒 NEW ORDER 🛒\n\n📋 Order Details:\n${orderItems}\n\n💰 Total Bill: $${totalAmount}\n\n✅ Order confirmed!`;
}

// Update stock for each cart item in Supabase
async function updateStockForCartItems() {
    try {
        // Fetch current products
        const response = await fetch(`${SUPABASE_URL}product`, {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch products');
        }
        
        const products = await response.json();
        
        // Update stock for each cart item
        const updatePromises = cart.map(cartItem => {
            const product = products.find(p => p.name === cartItem.name);
            if (product && product.stock > 0) {
                const newStock = product.stock - 1; // Reduce by 1 for each item in cart
                
                return fetch(`${SUPABASE_URL}product?id=eq.${product.id}`, {
                    method: 'PATCH',
                    headers: {
                        'apikey': SUPABASE_ANON_KEY,
                        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=minimal'
                    },
                    body: JSON.stringify({ stock: newStock })
                });
            }
            return Promise.resolve(true);
        });
        
        const results = await Promise.all(updatePromises);
        return results.every(result => result && result.ok);
        
    } catch (error) {
        console.error('Stock update error:', error);
        return false;
    }
}

// Send order to WhatsApp
function sendOrderToWhatsApp(message) {
    try {
        const phoneNumber = '+923006955087';
        const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
        window.open(whatsappUrl, '_blank');
        
        console.log('Order sent to WhatsApp:', phoneNumber);
        showNotification('Order sent to WhatsApp!', 'success');
        
    } catch (error) {
        console.error('WhatsApp error:', error);
        showNotification('Failed to send WhatsApp message', 'error');
    }
}

// Update cart count display
function updateCartCount() {
    const cartBadge = document.getElementById('cartBadge');
    if (cartBadge) {
        // Calculate total items in cart
        const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
        cartBadge.textContent = totalItems;
    }
}
function updateProductUI(productCard, newStock) {
    const buyNowButton = productCard.querySelector('[data-buy-now]');
    const addToCartButton = productCard.querySelector('[data-add-to-cart]');
    
    if (newStock === 0) {
        // Show SOLD OUT state
        productCard.classList.add('grayscale', 'opacity-75');
        
        if (buyNowButton) {
            buyNowButton.textContent = 'SOLD OUT';
            buyNowButton.disabled = true;
            buyNowButton.className = 'w-full py-2 rounded-lg font-medium transition-colors bg-gray-300 text-gray-500 cursor-not-allowed';
        }
        
        if (addToCartButton) {
            addToCartButton.textContent = 'Sold Out';
            addToCartButton.disabled = true;
            addToCartButton.className = 'w-full py-2 rounded-lg font-medium transition-colors bg-gray-300 text-gray-500 cursor-not-allowed';
        }
        
        // Add SOLD OUT badge if not present
        if (!productCard.querySelector('.bg-red-500')) {
            const soldOutBadge = document.createElement('div');
            soldOutBadge.className = 'absolute top-2 right-2 bg-red-500 text-white px-3 py-1 rounded-full text-sm font-bold';
            soldOutBadge.textContent = 'SOLD OUT';
            productCard.querySelector('.relative').appendChild(soldOutBadge);
        }
    } else {
        // Update stock display if needed
        console.log('Stock updated to:', newStock, '- Product still available');
    }
}

// Fetch products from Supabase
async function fetchProducts() {
    try {
        // Try REST API approach instead
        const response = await fetch(`${SUPABASE_URL}product`, {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log('Response status:', response.status);
        
        if (!response.ok) {
            console.error('HTTP Error:', response.status, response.statusText);
            return [];
        }
        
        const products = await response.json();
        console.log('Products fetched:', products);
        return products;
    } catch (error) {
        console.error('Error fetching products:', error);
        return [];
    }
}

// Render products dynamically
async function renderProducts() {
    const productsGrid = document.getElementById('productsGrid');
    if (!productsGrid) return;
    
    const products = await fetchProducts();
    
    if (products.length === 0) {
        productsGrid.innerHTML = '<div class="col-span-4 text-center text-gray-500">No products available</div>';
        return;
    }
    
    // Clear existing products
    productsGrid.innerHTML = '';
    
    // Render products from database
    products.forEach(product => {
        const productCard = createProductCard(product);
        productsGrid.appendChild(productCard);
    });
    
    // Re-attach event listeners
    attachEventListeners();
}

// Create product card element
function createProductCard(product) {
    const card = document.createElement('div');
    const isOutOfStock = product.stock === 0;
    
    // Apply grayscale filter for sold out items
    const cardClasses = isOutOfStock 
        ? 'bg-white rounded-lg shadow-md hover:shadow-xl transition-shadow grayscale opacity-75 w-full flex flex-col'
        : 'bg-white rounded-lg shadow-md hover:shadow-xl transition-shadow w-full flex flex-col';
    
    card.className = cardClasses;
    
    // Use image_url from database
    const imagePath = product.image_url || 'fabric2.jpeg';
    console.log('Using image URL from database:', imagePath);
    
    const imageContent = `
        <img src="${imagePath}" alt="${product.name}" class="w-full h-48 object-cover rounded-t-lg" onerror="console.log('Image failed to load:', this.src); this.style.display='none'; this.nextElementSibling.style.display='flex';">
        <div class="h-48 bg-gray-100 rounded-t-lg flex items-center justify-center" style="display:none;">
            <span class="text-gray-400">No Image</span>
        </div>
    `;
    
    card.innerHTML = `
        <div class="relative">
            ${imageContent}
            ${isOutOfStock ? '<div class="absolute top-2 right-2 bg-red-500 text-white px-3 py-1 rounded-full text-sm font-bold">SOLD OUT</div>' : ''}
        </div>
        <div class="p-3">
            <h3 class="font-bold text-sm mb-1 text-gray-900 truncate">${product.name || 'Unknown Product'}</h3>
            <p class="text-gray-600 text-xs mb-2 line-clamp-2">${product.description || 'Product description'}</p>
            <div class="flex items-center justify-between mb-3">
                <span class="text-xs font-bold text-gray-900">${product.price || '0'}</span>
                <span class="text-xs text-gray-500">Stock: ${product.stock || 0}</span>
            </div>
            <button class="w-full py-2 rounded-lg font-medium transition-colors text-xs ${
                isOutOfStock 
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
            }" ${isOutOfStock ? 'disabled' : ''} data-add-to-cart data-product-name="${product.name}" data-product-price="${product.price}">
                ${isOutOfStock ? 'Sold Out' : 'Add to Cart'}
            </button>
        </div>
    `;
    
    return card;
}

// Attach event listeners to buttons
function attachEventListeners() {
    // Add to Cart button listeners
    const addToCartButtons = document.querySelectorAll('button:not([disabled])');
    
    addToCartButtons.forEach(button => {
        if (button.textContent.includes('Add to Cart')) {
            button.addEventListener('click', function() {
                const productName = this.getAttribute('data-product-name');
                const priceText = this.getAttribute('data-product-price');
                const price = parseFloat(priceText.replace(/[^0-9.]/g, ''));
                
                addToCart(productName, price);
            });
        }
    });
}

// Add to cart functionality
function addToCart(productName, price) {
    // Check if product is in stock before adding
    checkProductStock(productName).then(isInStock => {
        if (!isInStock) {
            showNotification('Product is out of stock!', 'error');
            return;
        }
        
        // Check if item already exists in cart
        const existingItem = cart.find(item => item.name === productName);
        
        if (existingItem) {
            existingItem.quantity += 1;
        } else {
            cart.push({
                name: productName,
                price: parseFloat(price),
                quantity: 1
            });
        }
        
        cartCount++;
        updateCartCount();
        
        showNotification(`${productName} added to cart!`);
    });
}

// Check if product is in stock
async function checkProductStock(productName) {
    try {
        const response = await fetch(`${SUPABASE_URL}product?name=eq.${productName}`, {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            return false;
        }
        
        const products = await response.json();
        return products.length > 0 && products[0].stock > 0;
        
    } catch (error) {
        console.error('Stock check error:', error);
        return false;
    }
}

// Show notification
function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    const bgColor = type === 'success' ? 'bg-green-500' : 'bg-red-500';
    notification.className = `fixed top-20 right-6 ${bgColor} text-white px-6 py-3 rounded-lg shadow-lg z-50 transform translate-x-full transition-transform duration-300`;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 100);
    
    setTimeout(() => {
        notification.style.transform = 'translateX(200%)';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 2000);
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Cart modal event listeners
    const closeCartBtn = document.getElementById('closeCart');
    const clearCartBtn = document.getElementById('clearCartBtn');
    const checkoutBtn = document.getElementById('checkoutBtn');
    
    // Cart icon click listener
    const cartIcon = document.getElementById('cartIcon');
    if (cartIcon) {
        cartIcon.addEventListener('click', function(e) {
            e.preventDefault();
            openCart();
        });
    }
    
    if (closeCartBtn) {
        closeCartBtn.addEventListener('click', closeCart);
    }
    
    if (clearCartBtn) {
        clearCartBtn.addEventListener('click', function() {
            if (confirm('Are you sure you want to cancel your order?')) {
                clearCart();
                closeCart();
            }
        });
    }
    
    if (checkoutBtn) {
        checkoutBtn.addEventListener('click', async function() {
            if (cart.length > 0) {
                if (confirm('Complete your order? This will update stock and send order details to WhatsApp.')) {
                    checkoutBtn.disabled = true;
                    checkoutBtn.textContent = 'Processing...';
                    
                    await completeOrder();
                    
                    checkoutBtn.disabled = false;
                    checkoutBtn.textContent = 'Proceed to Checkout';
                }
            } else {
                showNotification('Your cart is empty', 'error');
            }
        });
    }
    
    // Close modal when clicking outside
    const modal = document.getElementById('cartModal');
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            closeCart();
        }
    });
    
    // Fetch and render products from Supabase
    renderProducts();
    
    // Smooth scroll for navigation links
    const navLinks = document.querySelectorAll('a[href^="#"]');
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href').substring(1);
            const targetElement = document.getElementById(targetId);
            if (targetElement) {
                targetElement.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
    
    // Shop Now button scroll
    const shopNowBtn = document.querySelector('button');
    if (shopNowBtn && shopNowBtn.textContent.includes('Shop Now')) {
        shopNowBtn.addEventListener('click', function() {
            const productsSection = document.getElementById('products');
            if (productsSection) {
                productsSection.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    }
});

// Header scroll effect
window.addEventListener('scroll', function() {
    const header = document.querySelector('header');
    if (window.scrollY > 50) {
        header.classList.add('shadow-lg');
    } else {
        header.classList.remove('shadow-lg');
    }
});
