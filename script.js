// Baby Store JavaScript

// ==========================================
// SUPABASE DATABASE CONFIGURATION
// ==========================================
// URL: REST API endpoint for Supabase database
// ANON_KEY: Public authentication key for API access
const SUPABASE_URL = 'https://dylgzqfgcfsrjfejjhjy.supabase.co/rest/v1/';
const SUPABASE_ANON_KEY = 'sb_publishable_bHly-c0wyjZeKsj8pghYbw_TVhG5pyx';

// ==========================================
// GLOBAL VARIABLES
// ==========================================
// cart: Array to store shopping cart items
// cartCount: Counter for total items in cart
let cart = [];
let cartCount = 0;

// ==========================================
// CART MODAL FUNCTIONS
// ==========================================
// Function to open the cart modal
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

// ==========================================
// ORDER COMPLETION SYSTEM
// ==========================================
// completeOrder: Main function to process entire order workflow
// Steps: 1) Validate cart, 2) Prepare message, 3) Update stock, 4) Send WhatsApp, 5) Clear cart
async function completeOrder() {
    try {
        // Validation: Check if cart has items
        if (cart.length === 0) {
            showNotification('Your cart is empty', 'error');
            return;
        }
        
        // Step A: Format order details for WhatsApp message
        const orderMessage = prepareOrderMessage();
        
        // Step B: Update product stock in Supabase database
        // This reduces stock by 1 for each item in cart
        const stockUpdateSuccess = await updateStockForCartItems();
        
        if (stockUpdateSuccess) {
            // Step C: Send order details to WhatsApp
            sendOrderToWhatsApp(orderMessage);
            
            // Step D: Clear cart and update UI
            cart = [];
            updateCartCount();
            closeCart();
            
            showNotification('Order completed successfully!', 'success');
            
            // Refresh product grid to show updated stock levels
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
        
        // Show confirmation alert first
        const userConfirmed = confirm('Confirm Order?\n\nYour order details will be sent to WhatsApp.\nClick OK to continue.');
        
        if (!userConfirmed) {
            return; // User cancelled
        }
        
        // Trigger confetti animation
        triggerConfetti();
        
        // Show success modal
        showSuccessModal();
        
        // Use api.whatsapp.com for better iPhone support
        const whatsappUrl = `https://api.whatsapp.com/send?phone=${phoneNumber}&text=${encodeURIComponent(message)}`;
        
        // Use location.assign for better Safari compatibility
        window.location.assign(whatsappUrl);
        
        console.log('Order sent to WhatsApp:', phoneNumber);
        showNotification('Order sent to WhatsApp!', 'success');
        
    } catch (error) {
        console.error('WhatsApp error:', error);
        showNotification('Failed to send WhatsApp message', 'error');
    }
}

// Trigger confetti animation
function triggerConfetti() {
    // Check if confetti library is loaded
    if (typeof confetti === 'undefined') {
        console.error('Confetti library not loaded');
        return;
    }
    
    console.log('Triggering confetti animation...');
    
    // Create multiple confetti bursts for luxury effect
    const count = 200;
    const defaults = {
        origin: { y: 0.7 }
    };

    function fire(particleRatio, opts) {
        confetti(Object.assign({}, defaults, opts, {
            particleCount: Math.floor(count * particleRatio)
        }));
    }

    // Gold and white confetti for luxury feel
    fire(0.25, {
        spread: 26,
        startVelocity: 55,
        colors: ['#FFD700', '#FFFFFF', '#FFF8DC', '#F0E68C']
    });
    
    fire(0.2, {
        spread: 60,
        colors: ['#FFD700', '#FFFFFF', '#FFF8DC']
    });
    
    fire(0.35, {
        spread: 100,
        decay: 0.91,
        scalar: 0.8,
        colors: ['#FFD700', '#FFFFFF']
    });
    
    fire(0.1, {
        spread: 120,
        startVelocity: 25,
        decay: 0.92,
        scalar: 1.2,
        colors: ['#FFD700']
    });
    
    fire(0.1, {
        spread: 120,
        startVelocity: 45,
        colors: ['#FFFFFF']
    });
}

// Show success modal
function showSuccessModal() {
    const modal = document.getElementById('successModal');
    modal.classList.remove('hidden');
    
    // Add CSS animation for checkmark
    const style = document.createElement('style');
    style.textContent = `
        .checkmark-animate {
            stroke-dasharray: 100;
            stroke-dashoffset: 100;
            animation: drawCheckmark 0.6s ease-in-out 0.3s forwards;
        }
        
        @keyframes drawCheckmark {
            to {
                stroke-dashoffset: 0;
            }
        }
        
        #successModal {
            animation: fadeIn 0.3s ease-in-out;
        }
        
        @keyframes fadeIn {
            from {
                opacity: 0;
                transform: scale(0.9);
            }
            to {
                opacity: 1;
                transform: scale(1);
            }
        }
    `;
    document.head.appendChild(style);
    
    // Auto-hide after 4 seconds
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 4000);
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

// Category and search functionality
let currentCategory = 'All';
let currentSearch = '';

// ==========================================
// PRODUCT FETCHING SYSTEM
// ==========================================
// fetchProducts: Retrieves products from Supabase with category and search filtering
// Returns: Array of product objects matching current filters
async function fetchProducts() {
    try {
        // Base URL for products endpoint
        let url = `${SUPABASE_URL}product`;
        
        // Category Filtering: Add category filter if not 'All'
        // Supabase syntax: ?category=eq.CategoryName
        if (currentCategory !== 'All') {
            url += `?category=eq.${currentCategory}`;
            console.log('Applying category filter:', currentCategory);
        }
        
        // API Call: Fetch products with authentication headers
        const response = await fetch(url, {
            headers: {
                'apikey': SUPABASE_ANON_KEY,           // API key for authentication
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, // Bearer token
                'Content-Type': 'application/json'     // JSON content type
            }
        });
        
        console.log('Response status:', response.status);
        
        // Error Handling: Check for HTTP errors
        if (!response.ok) {
            console.error('HTTP Error:', response.status, response.statusText);
            return [];
        }
        
        let products = await response.json();
        
        // Search Filtering: Apply client-side search if term exists
        if (currentSearch) {
            const searchTerm = currentSearch.toLowerCase();
            products = products.filter(product => {
                const name = (product.name || '').toLowerCase();
                const description = (product.description || '').toLowerCase();
                
                // Advanced Search: Multiple matching strategies
                return name.includes(searchTerm) ||           // Direct match
                       description.includes(searchTerm) ||      // Description match
                       name.split(' ').some(word => word.includes(searchTerm)) || // Word match
                       searchTerm.split(' ').some(term => name.includes(term) || description.includes(term)); // Multi-word match
            });
        }
        
        console.log('Products fetched:', products);
        return products;
    } catch (error) {
        console.error('Error fetching products:', error);
        return [];
    }
}

// ==========================================
// PRODUCT RENDERING SYSTEM
// ==========================================
// renderProducts: Fetches products and displays them in the grid
async function renderProducts() {
    try {
        const products = await fetchProducts();
        const productsGrid = document.getElementById('productsGrid');
        
        if (!productsGrid) {
            console.error('Products grid not found');
            return;
        }
        
        productsGrid.innerHTML = '';
        
        products.forEach(product => {
            const card = createProductCard(product);
            productsGrid.appendChild(card);
        });
        
        // Re-attach event listeners
        attachEventListeners();
        
        // Reinitialize scroll animations for new products
        setTimeout(() => {
            initScrollAnimations();
        }, 100);
    } catch (error) {
        console.error('Error rendering products:', error);
    }
}

// ==========================================
// PRODUCT CARD CREATION
// ==========================================
// createProductCard: Creates individual product card element with glassmorphism design
function createProductCard(product) {
    const card = document.createElement('div');
    const isOutOfStock = product.stock === 0;
    
    // Apply glassmorphism design for product cards
    const cardClasses = isOutOfStock 
        ? 'bg-white/80 backdrop-blur-sm rounded-3xl shadow-lg hover:shadow-xl transition-all grayscale opacity-75 w-full flex flex-col border border-white/30'
        : 'bg-white/80 backdrop-blur-sm rounded-3xl shadow-lg hover:shadow-xl transition-all w-full flex flex-col border border-white/30';
    
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
            ${isOutOfStock ? '<div class="absolute top-2 right-2 bg-blue-900 text-white px-3 py-1 rounded-full text-sm font-bold">SOLD OUT</div>' : ''}
        </div>
        <div class="p-3">
            <h3 class="font-bold text-sm mb-1 text-gray-900 truncate">${product.name || 'Unknown Product'}</h3>
            <p class="text-gray-600 text-xs mb-2 line-clamp-2">${product.description || 'Product description'}</p>
            <div class="flex items-center justify-between mb-3">
                <span class="text-xs font-bold text-gray-900">${product.price || '0'}</span>
                <span class="text-xs text-gray-500">Stock: ${product.stock || 0}</span>
            </div>
            <button class="w-full py-3 rounded-full font-medium transition-all duration-300 text-xs transform hover:scale-105 hover:shadow-lg ${
                isOutOfStock 
                    ? 'bg-gradient-to-r from-gray-400 to-gray-500 text-gray-300 cursor-not-allowed' 
                    : 'bg-gradient-to-r from-yellow-400 to-yellow-600 text-white hover:from-yellow-500 hover:to-yellow-700'
            }" ${isOutOfStock ? 'disabled' : ''} data-add-to-cart data-product-name="${product.name}" data-product-price="${product.price}">
                ${isOutOfStock ? 'Sold Out' : 'Add to Cart'}
            </button>
        </div>
    `;
    
    return card;
}

// Smooth scroll functionality
function initSmoothScroll() {
    // Smooth scroll for navigation links
    const smoothScrollLinks = document.querySelectorAll('.smooth-scroll');
    
    smoothScrollLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            const targetId = this.getAttribute('href').substring(1);
            const targetElement = document.getElementById(targetId);
            
            if (targetElement) {
                const offsetTop = targetElement.offsetTop - 80; // Account for sticky header
                
                window.scrollTo({
                    top: offsetTop,
                    behavior: 'smooth'
                });
            }
        });
    });
    
    // Scroll to top button functionality
    const scrollToTopBtn = document.getElementById('scrollToTop');
    
    window.addEventListener('scroll', function() {
        if (window.pageYOffset > 300) {
            scrollToTopBtn.classList.remove('opacity-0', 'pointer-events-none');
            scrollToTopBtn.classList.add('opacity-100');
        } else {
            scrollToTopBtn.classList.add('opacity-0', 'pointer-events-none');
            scrollToTopBtn.classList.remove('opacity-100');
        }
    });
    
    scrollToTopBtn.addEventListener('click', function() {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
}

// Attach event listeners to buttons
function attachEventListeners() {
    // Category filter buttons
    const categoryButtons = document.querySelectorAll('.category-btn');
    categoryButtons.forEach(button => {
        // Handle both click and touch events for better mobile support
        const handleCategoryClick = function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('Category filter clicked:', this.getAttribute('data-category'));
            
            // Update active button styling
            categoryButtons.forEach(btn => {
                btn.classList.remove('bg-blue-900', 'text-white');
                btn.classList.add('bg-gray-200', 'text-gray-700');
            });
            
            this.classList.remove('bg-gray-200', 'text-gray-700');
            this.classList.add('bg-blue-900', 'text-white');
            
            // Update current category and re-render
            currentCategory = this.getAttribute('data-category');
            console.log('Category filter applied:', currentCategory);
            renderProducts();
        };
        
        button.addEventListener('click', handleCategoryClick);
        button.addEventListener('touchstart', handleCategoryClick, { passive: false });
    });
    
    // Search bar functionality with debouncing
    const searchInput = document.getElementById('searchInput');
    let searchTimeout;
    
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            clearTimeout(searchTimeout);
            
            searchTimeout = setTimeout(() => {
                currentSearch = this.value.trim();
                renderProducts();
            }, 300); // Wait 300ms after typing stops
        });
    }
    
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

// ==========================================
// SCROLL ANIMATION SYSTEM
// ==========================================
// Intersection Observer for scroll-triggered animations
function initScrollAnimations() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // Observe all product cards
    const productCards = document.querySelectorAll('#productsGrid > div');
    productCards.forEach((card, index) => {
        // Initial state: hidden and below
        card.style.opacity = '0';
        card.style.transform = 'translateY(30px)';
        card.style.transition = `opacity 0.6s ease ${index * 0.1}s, transform 0.6s ease ${index * 0.1}s`;
        
        // Start observing
        observer.observe(card);
    });
}

// ==========================================
// MOBILE MENU FUNCTIONALITY
// ==========================================
// Mobile menu toggle
function initMobileMenu() {
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const mobileMenu = document.getElementById('mobileMenu');
    
    if (mobileMenuBtn && mobileMenu) {
        console.log('Mobile menu initialized');
        
        // Handle both click and touch events for better mobile support
        const toggleMenu = function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('Mobile menu toggled');
            mobileMenu.classList.toggle('hidden');
        };
        
        mobileMenuBtn.addEventListener('click', toggleMenu);
        mobileMenuBtn.addEventListener('touchstart', toggleMenu, { passive: false });
        
        // Close mobile menu when clicking on links
        const mobileMenuLinks = document.querySelectorAll('.mobile-menu-link');
        mobileMenuLinks.forEach(link => {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                console.log('Mobile menu link clicked');
                mobileMenu.classList.add('hidden');
            });
            
            // Also handle touch events for links
            link.addEventListener('touchstart', function(e) {
                e.preventDefault();
                console.log('Mobile menu link touched');
                mobileMenu.classList.add('hidden');
            }, { passive: false });
        });
    }
}

// Initialize the app
document.addEventListener('DOMContentLoaded', function() {
    renderProducts();
    initSmoothScroll();
    initScrollAnimations();
    initMobileMenu();
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
