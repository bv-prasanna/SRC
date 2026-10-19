package in.srcenterprises.api;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
@SpringBootTest(properties={"SRC_ADMIN_USERNAME=testadmin","SRC_ADMIN_PASSWORD=testpassword-long-strong","DB_URL=jdbc:h2:mem:srcapi;DB_CLOSE_DELAY=-1"})
@AutoConfigureMockMvc
class CatalogSecurityTest {
 @Autowired MockMvc mvc;
 @Test void publicCatalogAvailable() throws Exception {mvc.perform(get("/api/catalog/products")).andExpect(status().isOk());}
 @Test void adminRequiresAuthentication() throws Exception {mvc.perform(get("/api/admin/products")).andExpect(status().isUnauthorized());}
 @Test void noCheckoutEndpoint() throws Exception {mvc.perform(post("/api/checkout")).andExpect(status().isForbidden());}
 @Test void healthAvailable() throws Exception {mvc.perform(get("/actuator/health")).andExpect(status().isOk());}
}
